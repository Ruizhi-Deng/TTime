import { StoreTypeEnum } from '../../../common/enums/StoreTypeEnum'

/**
 * 获取
 *
 * @param key key
 * @return any
 */
export const cacheGet = (key): any => {
  return cacheGetByType(StoreTypeEnum.CONFIG, key)
}

/**
 * 设置
 *
 * @param key key
 * @param val val
 */
export const cacheSet = (key, val): void => {
  cacheSetByType(StoreTypeEnum.CONFIG, key, val)
}

/**
 * 删除
 *
 * @param key key
 */
export const cacheDelete = (key): void => {
  cacheDeleteByType(StoreTypeEnum.CONFIG, key)
}

/**
 * 设置
 *
 * @param storeType 存储类型
 * @param key key
 * @return any
 */
export const cacheGetByType = (storeType, key): any => {
  return window.api['cacheGet'](storeType, key)
}

/**
 * 设置
 *
 * @param storeType 存储类型
 * @param key key
 * @param val val
 */
export const cacheSetByType = (storeType, key, val): void => {
  const type = Object.prototype.toString.call(val)
  if (type === '[object Object]' || type === '[object Array]') {
    val = JSON.parse(JSON.stringify(val))
  }
  window.api['cacheSet'](storeType, key, val)
}

/**
 * 删除
 *
 * @param storeType 存储类型
 * @param key key
 */
export const cacheDeleteByType = (storeType, key): void => {
  window.api['cacheDelete'](storeType, key)
}
