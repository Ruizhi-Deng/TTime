<template>
  <div class='block' :class='{ "manual-height": manualHeight }'>
    <Header />
    <div class='block-layer'>
      <Input
        ref='translateInput'
        @show-result-event='(value) => translatedResultInput.setShowResult(value)'
        @request-id-event='(value) => translatedResultInput.setRequestId(value)'
        @is-result-loading-event='(value) => translatedResultInput.setIsResultLoading(value)'
        v-show='!hideTranslateInput'
      />

      <language-select
        v-show='!hideTranslateLanguage'
      />

      <input-result-content ref='translatedResultInput' />
    </div>
    <div
      class='resize-grip'
      title='拖拽调整窗口大小'
      @pointerdown='startResize'
      @pointermove='moveResize'
      @pointerup='endResize'
      @pointercancel='endResize'
      @lostpointercapture='endResize'
    />
  </div>
</template>

<script setup lang='ts'>
import Header from './components/Header.vue'
import Input from './components/Input.vue'
import LanguageSelect from './components/LanguageSelect.vue'
import InputResultContent from './components/InputResultContent.vue'

import { nextTick, onUnmounted, ref } from 'vue'
import ElMessageExtend from '../utils/messageExtend'

import { isNull } from '../../../common/utils/validate'
import { buildTranslateService, setTranslateServiceMap } from '../utils/translateServiceUtil'
import { buildOcrService, setOcrServiceMap } from '../utils/ocrServiceUtil'
import { initTheme } from '../utils/themeUtil'
import { cacheGet } from '../utils/cacheUtil'
import '../channel/ChannelRequest'
import TranslateServiceEnum from '../../../common/enums/TranslateServiceEnum'
import OcrServiceEnum from '../../../common/enums/OcrServiceEnum'
import { YesNoEnum } from '../../../common/enums/YesNoEnum'

initTheme()

// 翻译输入组件
const translateInput = ref('')
const translatedResultInput = ref('')
const hideTranslateInput = ref(false)
const hideTranslateLanguage = ref(false)
const manualHeight = ref(false)
let resizePointer: number | undefined

window.api.winSizeUpdate((bounds) => {
  manualHeight.value = bounds.manualHeight === true
})

const startResize = (event: PointerEvent): void => {
  if (event.button !== 0 || resizePointer !== undefined) return
  event.preventDefault()
  resizePointer = event.pointerId
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  window.api.startWindowResize()
}

const moveResize = (event: PointerEvent): void => {
  if (event.pointerId === resizePointer) window.api.moveWindowResize()
}

const endResize = (event: PointerEvent): void => {
  if (event.pointerId !== resizePointer) return
  if (event.type === 'pointerup') window.api.moveWindowResize()
  window.api.endWindowResize()
  resizePointer = undefined
}

onUnmounted(() => window.api.endWindowResize())

// 页面高度改变监听
window.api.pageHeightChangeEvent()

// 清空翻译输入、结果内容事件
window.api.clearAllTranslateContentEvent(() => {
  translatedResultInput.value.clearTranslatedResultContentEvent()
  translateInput.value.clearTranslatedContentEvent()
})

// 输入翻译触发的窗口显示事件
window.api.winShowByInputEvent(() => {
  nextTick(() => {
    // 当输入翻译触发显示窗口时 并且用户没有进行任何操作时
    // 会导致窗口大小一直是最大的 所以这里获取页面高度更新窗口大小
    window.api.windowHeightChangeEvent()
    hideTranslateInput.value = cacheGet('hideTranslateInput') === YesNoEnum.Y
    hideTranslateLanguage.value = cacheGet('hideTranslateLanguage') === YesNoEnum.Y
  })
})

/**
 * 翻译服务list 如果不存在则说明第一次打开
 * 初始化默认翻译服务
 */
if (isNull(cacheGet('translateServiceMap'))) {
  const map = new Map()
  for (const type of [TranslateServiceEnum.GOOGLE_BUILT_IN, TranslateServiceEnum.BING_DICT, TranslateServiceEnum.DEEP_L_BUILT_IN]) {
    const service = buildTranslateService(type)
    map.set(service.id, service)
  }
  setTranslateServiceMap(map)
}

/**
 * 首次打开时初始化本地 OCR 服务
 */
if (isNull(cacheGet('ocrServiceMap'))) {
  const service = buildOcrService(OcrServiceEnum.TTIME)
  setOcrServiceMap(new Map([[service.id, service]]))
}

/**
 * 调起消息弹层提示事件
 */
window.api.showMsgEvent((type, msg) => {
  if (type === ElMessageExtend.SUCCESS) {
    ElMessageExtend.success(msg)
  } else if (type === ElMessageExtend.WARNING) {
    ElMessageExtend.warning(msg)
  } else if (type === ElMessageExtend.ERROR) {
    ElMessageExtend.errorInOptions(msg, { duration: 5 * 1000 })
  }
})
</script>

<style lang='scss' scoped>
@import '../css/translate.scss';
@import '../css/translate-input.scss';

.block {
  position: relative;
  margin-left: 10px;
  margin-right: 10px;
  border-radius: 8px;
  background-color: var(--ttime-translate-color-background);
  box-shadow: 1px 1px 4px -1px var(--ttime-box-shadow-color);
  border: solid 1px var(--ttime-translate-border-color);
}

.block.manual-height {
  box-sizing: border-box;
  height: calc(100vh - 5px);
  display: flex;
  flex-direction: column;

  > :first-child {
    flex-shrink: 0;
  }

  .block-layer {
    flex: 1;
    min-height: 0;
    max-height: none;
  }
}

.resize-grip {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  z-index: 10;
  cursor: nwse-resize;
  touch-action: none;
  user-select: none;
  -webkit-app-region: no-drag;
  border-bottom-right-radius: 8px;
  background-color: var(--ttime-translate-color-background);

  &::after {
    content: '';
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 9px;
    height: 9px;
    background: repeating-linear-gradient(135deg, transparent 0 3px, #999 3px 4px);
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
  }
}

.block-layer {
  overflow: auto;
  max-height: 671px;
  overflow-x: hidden;
}

.block-layer::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.block-layer::-webkit-scrollbar-thumb {
  border-radius: 3px;
  -moz-border-radius: 3px;
  -webkit-border-radius: 3px;
  background-color: #c3c3c3;
}

.block-layer::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>
