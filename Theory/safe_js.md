# Basic Confusions About JavaScript

JS混淆：通过复杂冗余的代码替换，把原来可读性高的代码转化为可读性低的代码，且前后执行效果等同

```js
Date.prototype.format = function(formatStr) {
    var str = formatStr;
    var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
    str = str.replace(/yyyy|YYYY/, this.getFullYear())
    .replace(/mm|MM/, (this.getMonth() + 1) > 9 ? (this.getMonth() + 1).toString() : '0' + (this.getMonth() + 1).toString())
    .replace(/dd|DD/, this.getDate() > 9 ? this.getDate().toString() : '0' + this.getDate().toString());
    return str;
}
console.log(new Date().format('yyyy-MM-dd'));
```

上面是一段简单的代码，用于实现日期格式化

但若这是某网站前端的一段关键代码，如前后端的通信过程，那么在代码发布后就很可能被某些有心人利用，而JS混淆做的事情就是增加破解的成本，用以防护JS代码。

## 0x01 String obfuscation

### Object Attributes Access

```js
function Dog(name) {
    this.name = name;
}
Dog.prototype.bark = function(){
    console.log("Hello");
}
var d = new Dog('taco');
console.log(d.name);  // taco
d.bark();  // Hello
console.log(d['name']);  // taco
d['bark'](); // Hello 
```

有两种方式访问对象的属性（方法可以看作特殊的属性）：

* `d.name`：name为一个标识符，无法加密或拼接
* `d['name']`：name为一个字符串，可以进行加密或拼接

`Date`是JS的内置对象，在JS中，很多内置对象都是`window`对象的属性。实际上JS代码中定义的全局变量/方法都是全局对象`window`的属性/方法，全局对象的属性和方法在调用时可省略对象名

```
new window.Date();
new Date(); // 等价
```

替换脚本：

```python
import re

with open('test.js', 'r') as file:
    js_code = file.read()

# Use regular expressions to find and replace dot notation with bracket notation
modified_code = re.sub(r'(\s)Date(\()', r"\1window.Date\2" ,js_code)
modified_code = re.sub(r'(\w+|\s|\)|\])\.(\w+)', r"\1['\2']", modified_code)

print(modified_code)
```

所以上面的代码可以改写为如下：

```js
Date['prototype'].format = function(formatStr) {
    var str = formatStr;
    str = str['replace'](/yyyy|YYYY/, this['getFullYear']())
    ['replace'](/mm|MM/, (this['getMonth']() + 1) > 9 ? (this['getMonth']() + 1)['toString']() : '0' + (this['getMonth']() + 1)['toString']())
    ['replace'](/dd|DD/, this['getDate']() > 9 ? this['getDate']()['toString']() : '0' + this['getDate']()['toString']());
    return str;
}
console['log'](new window['Date']()['format']('yyyy-MM-dd'));
```

将对象属性/方法的访问方式改成中括号后，就能进行下一步字符串混淆了

### Hex

JS中的字符串支持十六进制表示

```python
text = 'yyyy-MM-dd'
hexStr = ''
for _ in text:
    hexStr += hex(ord(_)).replace('0', '\\', 1)
print(hexStr)
# '\x79\x79\x79\x79\x2d\x4d\x4d\x2d\x64\x64'
```

十六进制的字符串放到控制台回车就能还原

### unicode

JS中不止字符串可以用unicode，标识符也支持unicode形式

```python
string = "Date"
unicode_string = ''.join(['\\u' + hex(ord(char))[2:].zfill(4) for char in string])
print(unicode_string)
# \u0044\u0061\u0074\u0065
```

`new \u0044\u0061\u0074\u0065()` = `new Date()`

非常之amazing啊

```js
Date.prototype.\u0066\u006f\u0072\u006d\u0061\u0074 = function(formatStr) {
    var \u0073\u0074\u0072 = \u0066\u006f\u0072\u006d\u0061\u0074\u0053\u0074\u0072;
    str = str.\u0072\u0065\u0070\u006c\u0061\u0063\u0065(/yyyy|YYYY/, this.getFullYear())
    .replace(/mm|MM/, (this.getMonth() + 1) > 9 ? (this.getMonth() + 1).toString() : '0' + (this.getMonth() + 1).toString())
    .replace(/dd|DD/, this.getDate() > 9 ? this.getDate().toString() : '0' + this.getDate().toString());
    return str;
}
console.log(new \u0077\u0069\u006e\u0064\u006f\u0077['\u0044\u0061\u0074\u0065']()['format']('\u0079\u0079\u0079\u0079\u002d\u004d\u004d\u002d\u0064\u0064'));
```

但实际JS混淆中，标识符一般不会替换成unicode形式，因为要还原十分简单，直接放控制台输出就行。通常的混淆方式是替换成没有语义的，但看上去相似的名字，如`_0x21dd83`、`_0x21dd84`，或者是由大写字母O、小写字母o、数字0组成的名字，如`O0o00O`、`O0o00o`（标识符不以数字开头）

### ASCII Array

既可以用来混淆字符串，也可以用来混淆代码

```js
function stringToCharCodes(str){
    var arr = [];
    for(var i = 0; i < str.length; i++){
        arr.push(str.charCodeAt(i));
    }
    return arr;
}
console.log(stringToCharCodes('var a = 100;alert(a);'));
```

使用`fromCharCode`来还原，但这个函数接收可变长度参数，不接收数组，可以使用apply（apply方法从`Function.prototype`继承过来）

```js
var codeStr = String.fromCharCode.apply(null,[118, 97, 114, 32, 97, 32, 61, 32, 49, 48, 48, 59, 97, 108, 101, 114, 116, 40, 97, 41, 59]);
```

通过`eval`来执行字符串代码

```js
eval(codeStr)
```

### String Constant

将字符串编码得到密文，使用前再调用相应的解码函数去解密，得到明文

```js
btoa('secret')  // base64编码
atob('c2VjcmV0')  // base64解码
```

建议减少使用JS自带的函数，而是自己去实现相应的函数，因为不管如何混淆，最终执行过程中，JS自带的函数名是固定的，可以通过Hook技术定位到关键代码。

### Number Constant

在使用一些加密算法或哈希算法中，会用到一些数值常量，如MD5中的`0x67452301`、`0xefcdab89`、`0x98badcfe`，通过这些常量可以识别出使用的算法，因此有必要对这些常量进行编码。如使用异或的特性：a ^ b = c 则 c ^ b = a，要替换掉a，c相当于密文，b相当于密钥

## 0x02 Reference obfuscation

### Array Index

JS的数组可以存在各种类型，将代码中的字符串、布尔值、数组、函数、对象等放到一个大数组中，使用的时候再进行引用，可以有效降低代码可读性

```js
var BigArr = [
    'cmVwbGFjZQ==', // replace
    'Z2V0RnVsbFllYXI=', // getFullYear
    'Z2V0TW9udGg=', // getMonth
    'Z2V0RGF0ZQ==', // getDate
    'dG9TdHJpbmc=', // toString
    'MA==', // 0
    ""['constructor']['fromCharCode']  // ""['constructor']等同于String
]
Date.prototype.\u0066\u006f\u0072\u006d\u0061\u0074 = function(formatStr) {
    var \u0073\u0074\u0072 = \u0066\u006f\u0072\u006d\u0061\u0074\u0053\u0074\u0072;
    str = str[atob(BigArr[0])](/yyyy|YYYY/, this[atob(BigArr[1])]())
    .replace(/mm|MM/, (this[atob(BigArr[2])]() + 1) > 9 ? (this[atob(BigArr[2])] + 1)[atob(BigArr[4])]() : atob(BigArr[5]) + (this[atob(BigArr[2])]() + 1)[atob(BigArr[4])]())
    .replace(/dd|DD/, this[atob(BigArr[3])]() > 9 ? this[atob(BigArr[3])]()[atob(BigArr[4])]() : atob(BigArr[5]) + this[atob(BigArr[3])]()[atob(BigArr[4])]());
    return str;
}
console.log(new \u0077\u0069\u006e\u0064\u006f\u0077['\u0044\u0061\u0074\u0065']()['format']('\u0079\u0079\u0079\u0079\u002d\u004d\u004d\u002d\u0064\u0064'));
eval(BigArr[6].apply(null, [97, 108, 101, 114, 116, 40, 34, 54, 54, 54, 34, 41, 59]));
```

### Array Shuffle

上面数组混淆成员与索引是一一对应的，可以将数组打乱以增加逆向工作量，但引用前需要进行还原。

* pop：右边弹出
* shift：左边弹出
* unshift：左边插入
* push：右边插入

```js
var BigArr = [
    'cmVwbGFjZQ==', // replace
    'Z2V0RnVsbFllYXI=', // getFullYear
    'Z2V0TW9udGg=', // getMonth
    'Z2V0RGF0ZQ==', // getDate
    'dG9TdHJpbmc=', // toString
    'MA==', // 0
    ""['constructor']['fromCharCode']  // ""['constructor']等同于String
];
(function(arr, num){
    var shuffer = function(nums){
        while(nums--){
            arr.unshift(arr.pop());
        }
    };
    shuffer(num);
})(BigArr, 0x20);
console.log(BigArr);
// (7) ['Z2V0RGF0ZQ==', 'dG9TdHJpbmc=', 'MA==', ƒ, 'cmVwbGFjZQ==', 'Z2V0RnVsbFllYXI=', 'Z2V0TW9udGg=']
```

`fromCharCode`由原本的6换到了4

```js
var BigArr = [
    'Z2V0RGF0ZQ==', 
    'dG9TdHJpbmc=', 
    'MA==', 
    ""['constructor']['fromCharCode'], 
    'cmVwbGFjZQ==', 
    'Z2V0RnVsbFllYXI=', 
    'Z2V0TW9udGg='
];
(function(arr, num){
    var shuffer = function(nums){
        while(nums--){
            arr['push'](arr['shift']());
        }
    };
    shuffer(num);
})(BigArr, 0x20);
console.log(BigArr);
Date.prototype.\u0066\u006f\u0072\u006d\u0061\u0074 = function(formatStr) {
    var \u0073\u0074\u0072 = \u0066\u006f\u0072\u006d\u0061\u0074\u0053\u0074\u0072;
    str = str[atob(BigArr[0])](/yyyy|YYYY/, this[atob(BigArr[1])]())
    .replace(/mm|MM/, (this[atob(BigArr[2])]() + 1) > 9 ? (this[atob(BigArr[2])] + 1)[atob(BigArr[4])]() : atob(BigArr[5]) + (this[atob(BigArr[2])]() + 1)[atob(BigArr[4])]())
    .replace(/dd|DD/, this[atob(BigArr[3])]() > 9 ? this[atob(BigArr[3])]()[atob(BigArr[4])]() : atob(BigArr[5]) + this[atob(BigArr[3])]()[atob(BigArr[4])]());
    return str;
}
console.log(new \u0077\u0069\u006e\u0064\u006f\u0077['\u0044\u0061\u0074\u0065']()['format']('\u0079\u0079\u0079\u0079\u002d\u004d\u004d\u002d\u0064\u0064'));
eval(BigArr[6].apply(null, [97, 108, 101, 114, 116, 40, 34, 54, 54, 54, 34, 41, 59]));
```

### Junk Code

一些没有意义但可以混淆视听的代码

```js
function _0x20ab1fxe2(a, b){
    return a + b;
}
function _0x20ab1fxe1(a, b){
    return _0x20ab1fxe2(a, b);
}
_0x20ab1fxe1(new Date().getMonth(), 1);
```

上面将加法二项式拆成一个函数

函数调用表达式也可以处理成类似的花指令

```js
function test(a, b) {
    return (a + b) * 10;
}
function _0x20ab1fxe2(a, b, c){
    return a(b, c);
}
var str = 'mm'
str = _0x20ab1fxe2(test, 3, 4); // 70
```

### jsfuck

将js代码转化为只用6个字符就能表示的代码

```js
[、(、+、!)、]
```

* JS中的七种假值，其余均为真
  * false
  * undefined
  * null
  * 0
  * -0
  * NaN
  * ""
* `+`作一元运算符可以强转为数值类型
  * `+[]`  => `0`
  * `![]` => `false`
  * `!+[]` => `true`
  * `!![]` => `true`

如下在控制台输入会输出`hello`

```js
(+(+!+[]+[+[]]+[+!+[]]))[(!![]+[])[+[]]+(!![]+[][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]])[+!+[]+[+[]]]+([]+[])[([][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]])[+!+[]+[+[]]]+([][[]]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[])[+!+[]]+([][[]]+[])[+[]]+([][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]])[+!+[]+[+[]]]+(!![]+[])[+!+[]]][([][[]]+[])[+!+[]]+(![]+[])[+!+[]]+((+[])[([][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]])[+!+[]+[+[]]]+([][[]]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[])[+!+[]]+([][[]]+[])[+[]]+([][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]])[+!+[]+[+[]]]+(!![]+[])[+!+[]]]+[])[+!+[]+[+!+[]]]+(!![]+[])[!+[]+!+[]+!+[]]]](!+[]+!+[]+[+!+[]])[+!+[]]+(!![]+[])[!+[]+!+[]+!+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]+(!![]+[][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]])[+!+[]+[+[]]]
```

实际开发中，jsfuck应用有限，一般只应用于一部分代码（jsfuck代码量太大）

## 0x03 Protection in Execution Flow

### Control Flow Flattening

代码开发中会有很多流程控制相关的代码，即代码中有很多分支语句（if语句、switch语句），其中switch语句中case块是平级的，这就能应用到控制流平坦化。以下面代码为例

```js
function test(){
    var a = 100;
    var b = a + 200;
    var c = b + 300;
    var d = c + 400;
    var e = d + 500;
    var f = e + 600;
    return f;
}
console.log(test());
```

首先打乱语句顺序，将其放入switch语句中，再通过循环遍历分发器来决定执行顺序

```js
function test(){
    var distributor = '4|3|1|6|2|7|5'.split('|'), i = 0;
    while(!![]){
        switch(distributor[i++]) {
            case '1':
                var c = b + 300;
                continue;
            case '2':
                var e = d + 500;
                continue;
            case '3':
                var b = a + 200;
                continue;
            case '4':
                var a = 100;
                continue;
            case '5':
                return f;
                continue;
            case '6':
                var d = c + 400;
                continue;
            case '7':
                var f = e + 600;
                continue;
        }
        // 当switch计算结果与每个case都不匹配，退出循环
        break;
    }
}
console.log(test());
```

* 假如函数有`return`语句，执行到最后一个`case`就会退出（这里为`case '5'`）
* 假设函数没有`return`语句，JS中数组越界会返回`undefined`，匹配不到`case`会执行到`break`

```js
var BigArr = [
    'Z2V0RGF0ZQ==', 
    'dG9TdHJpbmc=', 
    'MA==', 
    ""['constructor']['fromCharCode'], 
    'cmVwbGFjZQ==', 
    'Z2V0RnVsbFllYXI=', 
    'Z2V0TW9udGg='
];
(function(arr, num){
    var shuffer = function(nums){
        while(nums--){
            arr['push'](arr['shift']());
        }
    };
    shuffer(num);
})(BigArr, 0x20);
Date.prototype.\u0066\u006f\u0072\u006d\u0061\u0074 = function(formatStr) {
    var distributor = '2|5|1|7|4'.split('|'), i = 0;
    while(!![]){
        switch(distributor[i++]){
            case '1':
                str = str[BigArr[6].apply(null, [114, 101, 112, 108, 97, 99, 101])](/mm|MM/, (this[atob(BigArr[2])]() + 1) > 9 ? (this[atob(BigArr[2])] + 1)[atob(BigArr[4])]() : atob(BigArr[5]) + (this[atob(BigArr[2])]() + 1)[atob(BigArr[4])]());
                continue;
            case '2':
                var \u0073\u0074\u0072 = \u0066\u006f\u0072\u006d\u0061\u0074\u0053\u0074\u0072;
                continue;
            case '4':
                return str;
                continue;
            case '5':
                str = str[atob(BigArr[0])](/yyyy|YYYY/, this[atob(BigArr[1])]());
                continue;
            case '7':
                str = str[BigArr[6].apply(null, [114, 101, 112, 108, 97, 99, 101])](/dd|DD/, this[atob(BigArr[3])]() > 9 ? this[atob(BigArr[3])]()[atob(BigArr[4])]() : atob(BigArr[5]) + this[atob(BigArr[3])]()[atob(BigArr[4])]());
                continue;
        }
        break;
    }
}
console.log(new \u0077\u0069\u006e\u0064\u006f\u0077['\u0044\u0061\u0074\u0065']()['format']('\u0079\u0079\u0079\u0079\u002d\u004d\u004d\u002d\u0064\u0064'));
```

### Comma Expression

逗号运算符把多个表达式或语句连成一个复合语句

上面的`test`函数可以修改为如下：

（这里把变量声明都放到了函数的形参，JS允许参数实参和形参数量不一致，没有传入实参为`undefined`）

```js
function test(a, b, c, d, e, f){
    return a = 100, b = a + 200, c = b + 300, d = c + 400, e = d + 500, f = e + 600, f;
}
console.log(test());
```

但这样只是把多条语句写在一行，没有太大的混淆力度，可以试试嵌套的逗号表达式

```js
function test(a, b, c, d, e, f){
    return f = (e = (d = (c = (b = (a = 100, a + 200), b + 300), c + 400), d + 500), a + 50, c + 80, e + 600), f;
}
console.log(test());
```

逗号表达式会顺序执行每条语句，并返回最后一条语句的执行结果，因此可以在中间添加没有意义的花指令（如这里在`e + 600`前加了`a + 50`、`c + 80`）

逗号表达式混淆不仅可以处理赋值表达式，也可以处理函数调用和对象成员表达式。试着使用逗号表达式混淆下面的test函数

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
function test() {
    var a = 1000;
    var b = sub(a, 500) + 300;
    var c = b + obj.add(b, 100);
    return obj.num + c;
}
console.log(test());
```

```js
function test(a, b, c) {
    return ((c = (b = (a = 1000, sub)(a, 500) + 300, obj.add)(b, 100) + b), obj.num + c); 
}
console.log(test());
```

## 0x04 Other Protection Strategies

### eval Encryption

上面已经讲过了eval会把字符串当js代码执行，但直接传字符串未免太显眼，除了上面的`fromCharCode`来还原字符串再传入eval，还可以把一个自执行函数作为eval的参数，自执行函数（可以看成一个解密函数）将返回一个字符串。

### Memory Explosion

往代码中加入死代码，正常情况下这段代码不会执行，当检测到函数被格式化或者函数被Hook，就会跳转到这段代码并执行，直到内存溢出，浏览器会提示Out of memory程序崩溃

```js
var d = [0x1, 0x0, 0x0];
function b() {
    for (var i=0x0, c=d.length; i<c; i++){
        d.push(Math.round(Math.random));
        c = d.length;
    }
}
```

上面这段代码不像`while(true)`那么明显，它不断往数组push，循环结束条件是`i<c`，但每次都更新c为数据长度，这段代码就永远不会结束了。

### formatted code detection

检测代码是否格式化，在Chrome开发者工具中把代码格式化后会产生一个后缀为`formatted`的文件。

js中函数是可以转字符串的，`func.toString()`或`func + ''`

这里利用的是格式化后多出来的换行符

```js
console.log("start");
function t(){
    return t.toString().search('(((.+)+)+)+$').toString();
}
a=t();
console.log("end");
```

执行上面这段代码会发现走不到`log("end")`，接着程序就卡死了

但若去掉t函数的回车换行就可以了

```js
console.log("start");
function t(){return t.toString().search('(((.+)+)+)+$').toString();}
a=t();
console.log("end");
```

serach 与 indexof 类似，不同的是 search 使用正则表达式匹配，而 indexOf 只是按字符串匹配的。serach将`(((.+)+)+)+$`视为正则表达式进行匹配。多了换行符就会无限递归下去。

下面是混淆后的版本：

```js
var _0x5647a6=function(){var _0xf77285=!![];return function(_0x138773,_0x1b2add){var _0x5d2349=_0xf77285?function(){if(_0x1b2add){var _0x5daeb2=_0x1b2add['apply'](_0x138773,arguments);_0x1b2add=null;return _0x5daeb2;}}:function(){};_0xf77285=![];return _0x5d2349;};}();var _0x16e48a=_0x5647a6(this,function(){return _0x16e48a['toString']()['search']('(((.+)+)+)+$')['toString']()['constructor'](_0x16e48a)['search']('(((.+)+)+)+$');});_0x16e48a();var a=0x1;
```

```js
var _0x5647a6 = function() {
	var _0xf77285 = !![];
	return function(_0x138773, _0x1b2add) {
		var _0x5d2349 = _0xf77285 ?
		function() {
			if (_0x1b2add) {
				var _0x5daeb2 = _0x1b2add['apply'](_0x138773, arguments);
				_0x1b2add = null;
				return _0x5daeb2;
			}
		}: function() {};
		_0xf77285 = ![];
		return _0x5d2349;
	};
} ();
var _0x16e48a = _0x5647a6(this,
function() {
	return _0x16e48a['toString']()['search']('(((.+)+)+)+$')['toString']()['constructor'](_0x16e48a)['search']('(((.+)+)+)+$');
});
_0x16e48a();
var a = 0x1;
```

