<template>
  <div class="prompt-settings">
    <div class="prompt-toolbar">
      <el-select v-model="selectedId" @change="selectPrompt">
        <el-option
          v-for="prompt in prompts"
          :key="prompt.id"
          :label="prompt.name"
          :value="prompt.id"
        />
      </el-select>
      <el-button @click="addPrompt">新增</el-button>
      <el-button @click="deletePrompt" :disabled="selectedId === 'translate'">删除</el-button>
    </div>
    <el-form label-position="top">
      <el-form-item label="名称">
        <el-input v-model="editing.name" />
      </el-form-item>
      <el-form-item label="系统提示词">
        <el-input
          v-model="editing.systemPrompt"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 6 }"
          spellcheck="false"
        />
      </el-form-item>
      <el-form-item label="用户提示词">
        <el-input
          v-model="editing.userPrompt"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 8 }"
          spellcheck="false"
        />
      </el-form-item>
    </el-form>
    <p v-pre>
      可用变量：{{ text }} 原文、{{ source }} 原文语言、{{ target }} 目标语言。用户提示词需要包含
      {{ text }}。
    </p>
    <p>提示词保存在本机。每个 AI 实例可独立选择提示词；新增实例默认使用「翻译」。</p>
    <el-button type="primary" @click="savePrompt">保存提示词</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AiPrompt } from '../../../../../common/utils/aiPrompts'
import { random } from '../../../../../common/utils/strUtil'
import { cacheGet, cacheSet } from '../../../utils/cacheUtil'
import { getTranslateServiceMap } from '../../../utils/translateServiceUtil'
import ElMessageExtend from '../../../utils/messageExtend'

const prompts = ref<AiPrompt[]>(cacheGet('aiPrompts'))
const selectedId = ref('translate')
const editing = ref<AiPrompt>({ ...prompts.value.find((prompt) => prompt.id === selectedId.value) })

const selectPrompt = (): void => {
  editing.value = { ...prompts.value.find((prompt) => prompt.id === selectedId.value) }
}

const addPrompt = (): void => {
  const prompt = { id: random(), name: '新提示词', systemPrompt: '', userPrompt: '{{text}}' }
  prompts.value.push(prompt)
  selectedId.value = prompt.id
  editing.value = { ...prompt }
}

const savePrompt = (): void => {
  if (!editing.value.name.trim()) return ElMessageExtend.warning('请填写提示词名称')
  if (!editing.value.userPrompt.includes('{{text}}'))
    return ElMessageExtend.warning('用户提示词需要包含 {{text}}')
  const index = prompts.value.findIndex((prompt) => prompt.id === editing.value.id)
  prompts.value[index] = { ...editing.value }
  cacheSet('aiPrompts', prompts.value)
  ElMessageExtend.success('提示词已保存到本机')
}

const deletePrompt = (): void => {
  const using = Array.from(getTranslateServiceMap().values()).find(
    (service) => service.aiPromptId === selectedId.value
  )
  if (using)
    return ElMessageExtend.warning(
      `「${using.serviceName}」正在使用此提示词，请先更换该实例的提示词`
    )
  prompts.value = prompts.value.filter((prompt) => prompt.id !== selectedId.value)
  cacheSet('aiPrompts', prompts.value)
  selectedId.value = 'translate'
  selectPrompt()
}
</script>

<style scoped>
.prompt-settings {
  padding: 8px 12px;
}
.prompt-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
p {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
