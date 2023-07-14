const fs = require('fs')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const t = require('@babel/types')
const { unsubscribe } = require('diagnostics_channel')
const generator = require('@babel/generator').default

class ConfoundUtils {
    constructor(ast, encryptFunc) {
        this.ast = ast
        this.bigArr = []
        this.encryptFunc = encryptFunc
    }
    // 改变对象属性访问方式:点访问->括号访问
    changeAccessMode() {
        traverse(this.ast, {
            MemberExpression(path) {
                if (t.isIdentifier(path.node.property)) {
                    let name = path.node.property.name
                    path.node.property = t.stringLiteral(name)
                    path.node.computed = true
                }
            }
        })
    }
    // 标准JS内置对象处理 Date->window['Date']
    changeBuiltinObjects() {
        traverse(this.ast, {
            Identifier(path) {
                let name = path.node.name;
                let list = 'eval|atob|btoa|parseInt|encodeURIComponent|Object|Function|Boolean|Number|Math|Date|String|RegExp|Array'.split('|');
                if(list.includes(name)){
                    path.replaceWith(t.memberExpression(t.identifier('window'), t.stringLiteral(name), true));
                }
            }
        })
    }
    // 数值常量加密
    numericEncrypt() {
        traverse(this.ast, {
            NumericLiteral(path) {
                let value = path.node.value
                let key = parseInt(Math.random() * (999999 - 100000) + 100000, 10) // 生成6位数字
                let cipher = value ^ key
                path.replaceWith(t.binaryExpression('^', t.numericLiteral(cipher), t.numericLiteral(key)))
                path.skip() // 生成的子节点也含有NumericLiteral,会造成死循环
            }
        })
    }
    // 字符串加密
    arrayConfound() {
        let bigArr = []
        let encryptFunc = this.encryptFunc
        traverse(this.ast, {
            StringLiteral(path) {
                let encoded = encryptFunc(path.node.value)
                let bigArrIndex = bigArr.indexOf(encoded)
                let index = bigArrIndex
                if (bigArrIndex == -1) {
                    // 未加密的字符串加密后放入bigArr
                    let length = bigArr.push(encoded)
                    index = length - 1
                }
                // atob(arr[index])
                let encStr = t.callExpression(
                    t.identifier('atob'),
                    [t.memberExpression(t.identifier('arr'), t.numericLiteral(index), true)]
                )
                path.replaceWith(encStr)
            }
        })
        bigArr = bigArr.map(function (v) {
            return t.stringLiteral(v)
        })
        this.bigArr = bigArr
    }
    // 数组乱序
    arrayShuffle() {
        (function (myArr, num) {
            var shuffle = function (nums) {
                while (--nums) {
                    myArr.unshift(myArr.pop())
                }
            }
            shuffle(++num)
        })(this.bigArr, 0x10)
    }
    // 二项式转函数花指令
    binary2Func() {
        traverse(this.ast, {
            BinaryExpression(path) {
                let operator = path.node.operator
                let left = path.node.left
                let right = path.node.right
                let a = t.identifier('a')
                let b = t.identifier('b')
                let funcName = path.scope.generateUidIdentifier('xxx')
                let func = t.functionDeclaration(
                    funcName,
                    [a, b],
                    t.blockStatement([t.returnStatement(
                        t.binaryExpression(operator, a, b)
                    )])
                )
                let nearBlock = path.findParent(function (p) {
                    return p.isBlockStatement()
                })
                nearBlock.node.body.unshift(func)
                path.replaceWith(t.callExpression(funcName, [left, right]))
            }
        })
    }
    // 十六进制字符串，用于混淆数组还原函数
    string2Hex() {
        function hexEnc(code) {
            for (var hexStr = "", i = 0, s; i < code.length; i++) {
                s = code.charCodeAt(i).toString(16)
                hexStr += "\\x" + s
            }
            return hexStr
        }
        traverse(this.ast, {
            MemberExpression(path) {
                if (t.isIdentifier(path.node.property)) {
                    let name = path.node.property.name
                    path.node.property = t.stringLiteral(hexEnc(name))
                    path.node.computed = true
                }
            }
        })
    }
    // 标识符混淆
    renameIdentifier() {
        // 标识符混淆之前先转成代码再解析,确保新生成的一些节点被解析到
        let code = generator(this.ast).code
        let newAst = parser.parse(code)
        function generateIdentifier(decNum) {
            let arr = ['O', 'o', '0']
            let retval = []
            while (decNum > 0) {
                retval.push(decNum % 3)
                decNum = parseInt(decNum / 3)
            }
            let identifier = retval.reverse().map(function (v) {
                return arr[v]
            }).join('')
            identifier.length < 6 ? (identifier = ('OOOOOO' + identifier).substr(-6)) :
                identifier[0] == '0' && (identifier = 'O' + identifier)
            return identifier
        }
        function renameOwnBinding(path) {
            let OwnBindingObj = {}, globalBindingObj = {}, i=0;
            path.traverse({
                Identifier(p){
                    let name = p.node.name;
                    let binding = p.scope.getOwnBinding(name);
                    binding && generator(binding.scope.block).code == path + ''
                     ? (OwnBindingObj[name] = binding) : (globalBindingObj[name] = 1);
                }
            });
            for(let oldName in OwnBindingObj) {
                do {
                    var newName = generateIdentifier(i++);
                } while(globalBindingObj[newName]);
                OwnBindingObj[oldName].scope.rename(oldName, newName);
            }
        };
        traverse(newAst, {
            'Program|FunctionExpression|FunctionDeclaration'(path){
                renameOwnBinding(path);
            }
        })
        this.ast = newAst;
    }
    base64Encrypt() {
        traverse(this.ast, {
            FunctionExpression(path) {
                let blockStatement = path.node.body
                let statements = blockStatement.body.map(function (v, idx) {
                    if (t.isReturnStatement(v)) return v
                    if (!(v.trailingComments && v.trailingComments[0].value == 'Base64Encrypt')) return v
                    delete v.trailingComments
                    delete blockStatement.body[idx + 1].leadingComments
                    let code = generator(v).code
                    let cipher = encode(code)
                    let decryptFunc = t.callExpression(t.identifier('atob'),
                        [t.stringLiteral(cipher)])
                    return t.expressionStatement(
                        t.callExpression(t.identifier('eval'), [decryptFunc])
                    )
                })
                path.get('body').replaceWith(t.blockStatement(statements))
            }
        })
    }
    asciiEncrypt() {
        traverse(this.ast, {
            FunctionExpression(path) {
                let blockStatement = path.node.body
                let statements = blockStatement.body.map(function (v, idx) {
                    if (t.isReturnStatement(v)) return v
                    if (!(v.trailingComments && v.trailingComments[0].value == 'AsciiEncrypt')) return v
                    delete v.trailingComments
                    delete blockStatement.body[idx + 1].leadingComments
                    let code = generator(v).code
                    let ascii = [].map.call(code, function (v) {
                        return t.numericLiteral(v.charCodeAt(0))
                    })
                    let decryptName = t.memberExpression(t.identifier('String'), t.identifier('fromCharCode'))
                    let decryptFunc = t.callExpression(decryptName, ascii)
                    return t.expressionStatement(
                        t.callExpression(t.identifier('eval'), [decryptFunc])
                    )
                })
                path.get('body').replaceWith(t.blockStatement(statements))
            }
        })
    }
    unshiftArrayDeclaration() {
        this.bigArr = t.variableDeclarator(t.identifier('arr'), t.arrayExpression(this.bigArr))
        this.bigArr = t.variableDeclaration('var', [this.bigArr])
        this.ast.program.body.unshift(this.bigArr)
    }
    astConcatUnshift(ast) {
        this.ast.program.body.unshift(ast)
    }
    getAst() {
        return this.ast
    }
}
function encode(e) {
    return btoa(unescape(encodeURIComponent(e))) // btoa不能编码中文
}

function main(){
    // 读取要混淆的代码
    const jscode = fs.readFileSync("./origin.js",{
        encoding: 'utf-8'
    });
    // 读取还原乱序数组的代码
    const unShuffleCode = fs.readFileSync("./shuffle.js", {
        encoding: 'utf-8'
    });
    // 将待混淆的代码转为ast
    let ast = parser.parse(jscode);
    // 把还原乱序数组的代码转为ast
    let shuffleAst = parser.parse(unShuffleCode);
    
    let confound = new ConfoundUtils(ast, encode);
    let confoundShuffle = new ConfoundUtils(shuffleAst);

    confound.changeAccessMode();
    confound.changeBuiltinObjects();
    confound.binary2Func();
    confound.arrayConfound();
    confound.arrayShuffle();
    confound.changeBuiltinObjects();

    // 加入数组乱序还原代码
    confoundShuffle.string2Hex();
    confound.astConcatUnshift(confoundShuffle.getAst().program.body[0]);

    // 大数组放入混淆代码的最前面
    confound.unshiftArrayDeclaration();

    // 标识符重命名
    confound.renameIdentifier();

    // 指定代码行进行base64和asccii的eval混淆
    confound.asciiEncrypt();
    confound.base64Encrypt();

    // 数值常量混淆
    confound.numericEncrypt();

    let code = generator(confound.getAst()).code;
    code = code.replace(/\\\\/g, '\\');

    fs.writeFileSync("./newJunk.js", code);
}
main();












