function verify(req, captcha) {
  console.log('req.session.captcha', req.session.captcha.toUpperCase())
  console.log('captcha', captcha.toUpperCase())
  if(req.session.captcha){
    if(req.session.captcha.toUpperCase() === captcha.toUpperCase()){
      req.session.captcha = null; //清空，防止多次使用
      return true;
    }
  }
  return false;
}

module.exports = verify