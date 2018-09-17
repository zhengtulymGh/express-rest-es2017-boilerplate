function verify(req, captcha) {
  if(req.session.captcha){
    if(req.session.captcha === captcha.toUpperCase()){
      req.session.captcha = null; //清空，防止多次使用
      return true;
    }
  }
  return false;
}

module.exports = verify