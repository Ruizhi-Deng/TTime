<template>
  <div class="img-block">
    <div class="image-canvas">
      <img class="img" :src="imgData" />
      <svg
        v-if="result && showBoxes"
        class="ocr-boxes"
        :viewBox="`0 0 ${result.width} ${result.height}`"
      >
        <polygon
          v-for="(line, index) in result.lines"
          :key="index"
          :points="line.box.map((point) => point.join(',')).join(' ')"
          vector-effect="non-scaling-stroke"
        >
          <title>{{ line.text }} · {{ (line.confidence * 100).toFixed(1) }}%</title>
        </polygon>
      </svg>
    </div>
  </div>
  <div class="function-tools-layer">
    <div class="function-tools-block">
      <el-checkbox v-if="result" v-model="showBoxes" size="small">识别框</el-checkbox>
      <el-tooltip placement="bottom-start">
        <template #content>复制图片</template>
        <a class="function-tools" @click="imgWriteShearPlate()">
          <svg-icon icon-class="copy" class="function-tools-icon" />
        </a>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { OcrResult } from '../../../../common/ocr/OcrResult'

import { isNull } from '../../../../common/utils/validate'
import ElMessageExtend from '../../utils/messageExtend'
const emit = defineEmits(['is-result-loading-event'])

const imgData = ref('')
const result = ref<OcrResult>()
const showBoxes = ref(true)
onUnmounted(
  window.api.updateOcrResult((value: OcrResult) => {
    result.value = value
  })
)

/**
 * 图片写入到剪贴板
 */
const imgWriteShearPlate = (): void => {
  if (isNull(imgData.value)) {
    ElMessageExtend.warning('复制的图片不存在')
    return
  }
  window.api.base64ImgWriteShearPlateEvent(imgData.value)
  ElMessageExtend.success('复制成功')
}

/**
 * 更新图片
 */
window.api.updateImg((img) => {
  result.value = undefined
  imgData.value = img
  emit('is-result-loading-event', true)
})
</script>

<style lang="scss" scoped>
@import '../../css/global.scss';

.img-block {
  border-radius: 7px;
  overflow: hidden;
  width: 100%;
  height: 93%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;

  .image-canvas {
    position: relative;
    width: 95%;
    height: 95%;
  }
  .img {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }
  .ocr-boxes {
    position: absolute;
    width: 100%;
    height: 100%;
    polygon {
      fill: rgba(70, 140, 255, 0.08);
      stroke: #468cff;
      stroke-width: 1.5;
    }
  }
}
.function-tools-layer {
  position: fixed;
  bottom: 21px;
}
</style>
