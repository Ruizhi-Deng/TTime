<template>
  <el-form label-width="100px" label-position="left">
    <el-form-item label="识别语言">
      <el-select v-model="language" :disabled="loading" @change="changeLanguage">
        <el-option v-for="item in languages" :key="item.id" :value="item.id" :label="item.name" />
      </el-select>
    </el-form-item>
    <el-form-item label="合并段落">
      <el-switch v-model="merge" @change="cacheSet('localOcrMergeParagraphs', merge)" />
    </el-form-item>
    <p>依据文本框的位置合并相邻行，保留英文单词间的空格。关闭后逐行输出。</p>
    <el-form-item label="模型状态">
      <el-tag :type="ready ? 'success' : 'info'">{{ ready ? '已就绪' : '尚未准备' }}</el-tag>
      <el-button class="prepare-button" :loading="loading" @click="prepareModels"
        >准备模型</el-button
      >
    </el-form-item>
    <p>PP-OCRv4 中英模型随安装包提供；其他语言首次使用时下载到本机。准备好后可离线识别。</p>
    <p v-if="error" class="model-error">{{ error }}</p>
  </el-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import registry from '../../../../../../common/ocr/models.json'
import { cacheGet, cacheSet } from '../../../../utils/cacheUtil'

const languages = registry.languages
const language = ref(cacheGet('localOcrLanguage'))
const merge = ref(cacheGet('localOcrMergeParagraphs'))
const ready = ref(false)
const loading = ref(false)
const error = ref('')

const updateStatus = async (): Promise<void> => {
  loading.value = true
  try {
    const result = await window.api.localOcrModelStatus(language.value)
    ready.value = result.ready
  } finally {
    loading.value = false
  }
}

const changeLanguage = async (): Promise<void> => {
  cacheSet('localOcrLanguage', language.value)
  ready.value = false
  error.value = ''
  await updateStatus()
}

const prepareModels = async (): Promise<void> => {
  loading.value = true
  error.value = ''
  try {
    const result = await window.api.prepareLocalOcrModels(language.value)
    ready.value = result.ready
    if (!result.ready) error.value = result.error
  } finally {
    loading.value = false
  }
}

onMounted(updateStatus)
</script>

<style scoped>
p {
  font-size: 12px;
  line-height: 1.7;
  color: #777;
  margin: 0 0 18px;
}
.prepare-button {
  margin-left: 12px;
}
.model-error {
  color: #d9534f;
  overflow-wrap: anywhere;
}
</style>
