import axios from 'axios'

// 创建 axios
const service = axios.create({
  // 请求超时时间(毫秒)
  timeout: 15000
})

/**
 * 响应拦截器
 * 得到请求响应体后对其进行处理
 */
service.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default service
