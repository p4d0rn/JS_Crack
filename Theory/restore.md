> The man fears losing already has lost

# 0x01 Common Strategies

## 还原数值常量

上一节混淆中对于数值常量的加密，是先随机生成一个key，再和value异或得到cipher，最后把原节点改成cipher异或key

还原思路：遍历`BinaryExpression`节点，取出left和right，判断其是否为`NumericLiteral`，接着调用`path.evaluate`方法来计算节点的值并替换原节点。`path.evaluate`返回的`confident`是一个布尔值，表示节点是否可以计算。

```js
let visitor = {
    BinaryExpression(path){
        let left = path.node.left;
        let right = path.node.right;
        if(t.isNumericLiteral(left) && t.isNumericLiteral(right)){
            let {confident, value} = path.evaluate();
            confident && path.replaceWith(t.valueToNode(value));
        }
    }
}
```

## 还原eval加密

遍历`CallExpression`节点，判断`callee.name`是否为`eval`

若`eval`的参数就是一个字符串，直接使用`types`组件的`identifier`让参数变成代码

若`eval`的参数是个表达式，提取其`arguments[0]`并通过`eval`计算出来

最后替换整个`CallExpression`节点

```js
let visitor = {
    CallExpression(path){
        if(path.node.callee.name != 'eval') return;
        let arguments = path.node.arguments;
        let code = generator(arguments[0]).code;
        if(t.isStringLiteral(arguments[0])){
            path.replaceWith(t.identifier(code));
        } else {
            path.replaceWith(t.identifier(eval(code)));
        }
    }
}
```

上面的解密函数是js内置的atob，若解密函数自定义的，得扣进代码中

## 还原unicode和hex字符串加密

JS中字符串可以是unicode或hex形式，标识符可以用unicode表示

Unicode字符串加密

```js
function unicodeEnc(str){
    var value = '';
    for(var i = 0;i < str.length;i++){
        value += "\\u" + ("0000" + parseInt(str.charCodeAt(i)).toString(16)).substr(-4);
    }
    return value;
}
let idVisitor = {
    Identifier(path){
        path.replaceWith(t.identifier(unicodeEnc(path.node.name)));
        path.skip();
    }
}
let strVisitor = {
    StringLiteral(path){
        path.replaceWith(t.stringLiteral(unicodeEnc(path.node.value)));
        path.skip();
    }
}
traverse(ast, idVisitor);
traverse(ast, strVisitor);
let code = generator(ast).code;
code = code.replace(/\\\\u/g,'\\u');
```

```js
\u0044\u0061\u0074\u0065.\u0070\u0072\u006f\u0074\u006f\u0074\u0079\u0070\u0065.\u0066\u006f\u0072\u006d\u0061\u0074 = function (\u0066\u006f\u0072\u006d\u0061\u0074\u0053\u0074\u0072) {
  var \u0073\u0074\u0072 = \u0066\u006f\u0072\u006d\u0061\u0074\u0053\u0074\u0072;
  var \u0057\u0045\u0045\u004b = ["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"];
  \u0073\u0074\u0072 = \u0073\u0074\u0072.\u0072\u0065\u0070\u006c\u0061\u0063\u0065(/yyyy|YYYY/, this.\u0067\u0065\u0074\u0046\u0075\u006c\u006c\u0059\u0065\u0061\u0072());
  \u0073\u0074\u0072 = \u0073\u0074\u0072.\u0072\u0065\u0070\u006c\u0061\u0063\u0065(/mm|MM/, this.\u0067\u0065\u0074\u004d\u006f\u006e\u0074\u0068() + 1 > 9 ? (this.\u0067\u0065\u0074\u004d\u006f\u006e\u0074\u0068() + 1).\u0074\u006f\u0053\u0074\u0072\u0069\u006e\u0067() : "\u0030" + (this.\u0067\u0065\u0074\u004d\u006f\u006e\u0074\u0068() + 1).\u0074\u006f\u0053\u0074\u0072\u0069\u006e\u0067());
  \u0073\u0074\u0072 = \u0073\u0074\u0072.\u0072\u0065\u0070\u006c\u0061\u0063\u0065(/dd|DD/, this.\u0067\u0065\u0074\u0044\u0061\u0074\u0065() > 9 ? this.\u0067\u0065\u0074\u0044\u0061\u0074\u0065().\u0074\u006f\u0053\u0074\u0072\u0069\u006e\u0067() : "\u0030" + this.\u0067\u0065\u0074\u0044\u0061\u0074\u0065().\u0074\u006f\u0053\u0074\u0072\u0069\u006e\u0067());
  return \u0073\u0074\u0072;
};
\u0063\u006f\u006e\u0073\u006f\u006c\u0065.\u006c\u006f\u0067(new \u0044\u0061\u0074\u0065().\u0066\u006f\u0072\u006d\u0061\u0074("\u0079\u0079\u0079\u0079\u002d\u004d\u004d\u002d\u0064\u0064"));
```

`generator`中传入一些配置即可还原

```js
let ast = parser.parse(jscode);
let code = generator(ast, {minified: true, jsescOption: {minimal: true}}).code;
ast = parser.parse(code);
code = generator(ast).code;
```

第二次parse和generator是为了把代码格式化

## 还原逗号表达式混淆

逗号表达式的还原要比混淆简单

逗号表达式在AST中为`SequenceExpression`，`expressions`节点就是逗号运算符连接的每一个表达式，`expressions`数组中最后一个成员就是逗号表达式整体的返回结果

```js
let visitor = {
    SequenceExpression: {
        exit(path){
            let expressions = path.node.expressions;
            let finalExpression = expressions.pop();
            let statement = path.getStatementParent();
            expressions.map(function(v){
                statement.insertBefore(t.expressionStatement(v));
            });
            path.replaceInline(finalExpression);
        }
    }
}
```

还原前

```js
var obj = {
    num : '0x',
    add : function(a, b) {
        return a + b;
    }
}
function sub(a, b) {
    return a - b;
}
function test(a, b, c) {
    return ((c = (b = (a = 1000, sub)(a, 500) + 300, obj.add)(b, 100) + b), obj.num + c); 
}
console.log(test());
```

还原后(只贴test函数)

```js
function test(a, b, c) {
  a = 1000;
  b = sub(a, 500) + 300;
  c = obj.add(b, 100) + b;
  return obj.num + c;
}
```

* 遍历`SequenceExpression`节点，提取`expressions`数组
* 将`expressions`数组最后一个成员，即逗号表达式整体的返回结果给`finalExpression`
* `path.getStatementParent`获取最近的父节点，然后把`expressions`数组的其他成员插入到父节点前面
* 最后用`finalExpression`替换原来的`SequenceExpression`

## 还原控制流平坦化混淆

* 首先得找到分发器的赋值语句，这里简单地提取函数体中第一条语句，判断其是否为`VariableDeclaration`节点，若是则提取其第一个变量声明的init属性
* 继续遍历`SwitchStatements`节点，获取其`cases`数组，根据上面获取的分发器数组`dispenser`的顺序去索引`cases`，将`SwitchCase`的内容放入`states`，最后一条continue语句记得去掉

* 最后把`FunctionDeclaration`的`body`属性替换掉

```js
let visitor = {
    FunctionDeclaration(path){
        let blockStatement = path.node.body;
        let dispenser;
        if(t.isVariableDeclaration(blockStatement.body[0])){
            let dispenserCode = blockStatement.body[0].declarations[0].init;
            dispenser = eval(generator(dispenserCode).code);
        }
        let states = [];
        path.traverse({
            SwitchStatement(p){
                dispenser.forEach(function(v){
                    let consequent = p.node.cases[+v-1].consequent;
                    states = [...states, ...consequent.slice(0, consequent.length - 1)];
                })
            }
        })
        path.get('body').replaceWith(t.blockStatement(states));
    }
}
```































