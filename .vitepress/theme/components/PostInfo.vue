<template>
  <div>
    <h1 class="title">{{ frontmatter.title }}</h1>
    <Author
      :author="frontmatter.author"
      v-if="frontmatter.author !== 'OakChaser'"
      style="margin-bottom: 16px" />
    <div style="display: flex; margin-bottom: 48px">
      <ClientOnly>
        <PostedDate
          :date="frontmatter.date"
          style="color: var(--palette-text); font-size: 0.9rem; margin-right: 8px" />
      </ClientOnly>
      <ReadingTime
        :time="frontmatter.minutes"
        style="font-size: 0.9rem; color: var(--palette-text)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import PostedDate from "./PostedDate.vue";
import ReadingTime from "./ReadingTime.vue";
import Author from "./Author.vue";
import { useData } from "vitepress";
const { frontmatter } = useData();
</script>

<style lang="less" scoped>
h1.title {
  font-size: 1.7rem;
  font-weight: bold;
  margin-bottom: 24px;
  line-height: 1.5;
}
</style>
