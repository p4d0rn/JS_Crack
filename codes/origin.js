Date.prototype.format = function (formatStr) {
    var str = formatStr;
    var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
    str = str.replace(/yyyy|YYYY/, this.getFullYear()) //AsciiEncrypt
    str = str.replace(/mm|MM/, this.getMonth() + 1 > 9 ? (this.getMonth() + 1).toString() : '0' + (this.getMonth() + 1).toString());
    str = str.replace(/dd|DD/, this.getDate() > 9 ? this.getDate().toString() : '0' + this.getDate().toString()); //Base64Encrypt
    return str;
  };
console.log(new Date().format('yyyy-MM-dd'));