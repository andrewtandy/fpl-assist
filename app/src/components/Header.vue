<template>
    <div class="site-header">
    <h1 class="site-header__title">FPL Assist</h1>
    <button class="icon-wrapper" type="button" aria-label="Open menu">
      <MenuIcon class="menu-icon" />
    </button>
    </div>
</template>

<script setup>
import MenuIcon from 'vue-material-design-icons/Menu.vue'
import 'vue-material-design-icons/styles.css'

</script>

<style lang="scss" scoped>

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.7rem 0rem 0.7rem;
}

.site-header__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  line-height: 1;
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 3rem;
  height: 3rem;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 0;
  cursor: pointer;
}

.menu-icon {
  display: block;
  // visibility: hidden;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
}

.menu-icon:deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

</style>