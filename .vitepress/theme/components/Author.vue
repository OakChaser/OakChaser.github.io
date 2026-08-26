<template>
  <div class="author">
    <img :src="avatarPath[props.author]" :alt="`${props.author}'s avatar`" />
    <div>
      <div class="author">{{ props.author }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  author: string;
}>();
const avatarPath = {
  "OakChaser": "/avatar.png",
};
</script>

<style lang="less" scoped>
div.author {
  display: flex;
  align-items: center;
  img {
    width: 36px;
    height: 36px;
    border-radius: 9999px;
    margin-right: 8px;
  }
  .author {
    font-size: 18px;
  }
  .author-description {
    margin-top: 4px;
    font-size: 12px;
    opacity: 0.8;
  }
}
</style>
