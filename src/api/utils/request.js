const axios = require('axios');
const FormData = require('form-data');
// const log4js = require('log4js');
// const requestLog = log4js.getLogger('request');

const request = function(options) {
  try {
    // console.log('options', options)
    console.log('api', options.req.api)
    // const referer = options.req.headers.referer
    // if (referer && referer) { // 有的用户可能设置不允许浏览器带上referer

    // }
    // console.log('options.req.headers.referer', options.req.headers.referer)
    // console.log('options.req', options.req)

    const reqTimeStart = new Date();
    const contentType = options.req.headers['content-type'];
    const isFormData = contentType && contentType.indexOf('form-data') >= 0;
    let formData = null;

    let data = options.req.body
    if (isFormData) {
      for (let p in data) {
        if (data[p] instanceof Array) {
          data[`${p}[]`] = []
          data[p].forEach(item => {
            data[`${p}[]`].push(item)
          })
          delete data[p]
        }
      }
      formData = new FormData();
      formData.append('my_field', 'my value');
      // console.log('axios data', data)
      // console.log('axios formData', formData)
      for (const key in data) {
        if (/\[\]$/.test(key)) {
          // console.log(key)
          data[key].forEach((v) => {
            formData.append(key, v)
          })
        } else {
          console.log('key', data[key])
          formData.append(key, data[key])
        }
      }
      console.log('axios formData', formData)
      options.req.files.forEach(file => {
        console.log('file.fieldname', file.fieldname)
        console.log('file.buffer', file.buffer)
        formData.append(file.fieldname, file.buffer)
      })
      // console.log('transformRequest formData: ', formData)
      // console.log('transformRequest new formData.getHeaders(): ', formData.getHeaders())
    }

    // console.log('axios options.req.params', options.req.params)
    // console.log('axios data', data)
    // console.log('axios formData', formData)

    let axiosOptions = {
      method: options.req.method,
      url: options.req.api,
      params: options.req.params, // get
      data, // post
      transformRequest: [(data) => {
        // 对 data 进行任意转换处理
        return formData ? formData : JSON.stringify(data)
      }],
      headers: {
        'Content-Type': isFormData ? formData.getHeaders()['content-type']
   : 'application/json; charset=utf-8'
      }
    }
    if (options.req.headers.authorization) {
      axiosOptions.headers['Authorization'] = `${options.req.headers.authorization}`
    }
    // console.log('axiosOptions', axiosOptions)
    return axios(axiosOptions).then((response) => {
      try {
        const reqTimeEnd = new Date();
        const reqTimeTotal = (reqTimeEnd - reqTimeStart);
        // console.log('response', response)
        const body = response.data
        // requestLog.info(reqTimeTotal + 'ms', 'success：【' + options.req.api + '】', JSON.stringify(), JSON.stringify(response.data));
        return Promise.resolve({
          node_data: response.data,
          node_status_code: response.status,
          node_status_text: response.statusText
        });
      } catch(error) {
        return tryCatchErrorHandle(error);
      }
    }).catch((error) => {
      try {
        const reqTimeEnd = new Date();
        const reqTimeTotal = (reqTimeEnd - reqTimeStart);
        // console.log('error', error);
        // console.log('error.message', error.message);
        // console.log('error.response', error.response);
        // console.log(JSON.stringify(error.response.data))
        // console.log('error.response.data', error.response.data)
        if (error.response) {
          // requestLog.info(reqTimeTotal + 'ms', 'fail：【' + options.req.api + '】', JSON.stringify(), JSON.stringify(error.response.data));
          return Promise.reject({
            node_error: error.response.data || {
              message: error.response.statusText
            },
            node_status_code: error.response.status,
            node_status_text: error.response.statusText
          });
        } else {
          // requestLog.info(reqTimeTotal + 'ms', 'fail：【' + options.req.api + '】', JSON.stringify(), JSON.stringify(error.message));
          return Promise.reject({
            node_error: {
              message: error.message
            },
            node_status_code: 500,
            node_status_text: error.message
          });
        }
      } catch(error) {
        return tryCatchErrorHandle(error);
      }
    })
  } catch(error) {
    return tryCatchErrorHandle(error);
  }
}

function tryCatchErrorHandle(error) {
  // console.log('axios try catch error', error)
  return Promise.reject({
    node_error: {
      message: error.message || {
        message: 'try catch error'
      }
    },
    node_status_code: 500,
    node_status_text: 'try catch error'
  });
}

module.exports = request;