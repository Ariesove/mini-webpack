const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");

function getModuleInfo(file) {
  // 读取文件
  const body = fs.readFileSync(file, "utf-8");

  // 转化AST语法树
  const ast = parser.parse(body, {
    sourceType: "module", //表示我们要解析的是ES模块
  });

  // 依赖收集
  const deps = {};
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(file);
      const abspath = "./" + path.join(dirname, node.source.value);
      // 收集绝对路径,和相对路径去了
      deps[node.source.value] = abspath;
    },
  })
  const { code } = babel.transformFromAst(ast, null, {
    presets: ['@babel/preset-env']
  })
  // console.log('deps', deps)
  const moduleInfo = { file, deps, code };
  return moduleInfo;

}

// getDeps 
//参数解构为何
function getDeps(temp, {deps}) {

  Object.keys(deps || {}).forEach((key) => {
    // 这里为什么称之为 child 呢，因为 deps[key] 是子模块的路径
    const child = getModuleInfo(deps[key]);
    //不是很理解
    temp.push(child)
    getDeps(temp, child);
  })



}

const parseModules = (file) => {
  // 分析入口文件
  let depsGraph = {}
  const info = getModuleInfo(file);
  const temp = [info];
  getDeps(temp, info);
  temp.forEach((moduleInfo) => {
    depsGraph[moduleInfo.file] = {
      deps: moduleInfo.deps,
      code: moduleInfo.code,
    }
  })

  return depsGraph



}
function bundle(file) {
  const depsGraph = JSON.stringify(parseModules(file));
  return `(function (graph) {
        function require(file) {
            function absRequire(relPath) {
                return require(graph[file].deps[relPath])
            }
            var exports = {};
            (function (require,exports,code) {
                eval(code)
            })(absRequire,exports,graph[file].code)
            return exports
        }
        require('${file}')
    })(${depsGraph})`;
}

const content = bundle("./src/index.js");
!fs.existsSync("./dist") && fs.mkdirSync("./dist");
fs.writeFileSync("./dist/bundle.js", content);

