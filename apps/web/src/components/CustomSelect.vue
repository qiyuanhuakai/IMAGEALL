<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

interface SelectOption {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  placement?: 'top' | 'bottom'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLDivElement>()
const listRef = ref<HTMLDivElement>()
const selectedRef = ref<HTMLDivElement>()

const selectedLabel = computed(() => {
  const found = props.options.find(opt => opt.value === props.modelValue)
  return found?.label ?? props.placeholder ?? ''
})

const activeIndex = computed(() => {
  return props.options.findIndex(opt => opt.value === props.modelValue)
})

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      scrollToActive()
    })
  }
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  isOpen.value = false
}

function scrollToActive() {
  if (!listRef.value) return
  const activeEl = listRef.value.querySelector('.cs-option--active')
  if (activeEl) {
    activeEl.scrollIntoView({ block: 'nearest' })
  }
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (props.disabled) return

  if (!isOpen.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      isOpen.value = true
      nextTick(() => scrollToActive())
    }
    return
  }

  switch (e.key) {
    case 'Escape':
      isOpen.value = false
      break
    case 'ArrowDown':
      e.preventDefault()
      navigateOption(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      navigateOption(-1)
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (activeIndex.value >= 0 && activeIndex.value < props.options.length) {
        selectOption(props.options[activeIndex.value]!.value)
      }
      break
  }
}

function navigateOption(direction: 1 | -1) {
  const newIndex = Math.max(0, Math.min(props.options.length - 1, activeIndex.value + direction))
  if (newIndex >= 0 && newIndex < props.options.length) {
    selectOption(props.options[newIndex]!.value)
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})

watch(isOpen, (open) => {
  if (open) {
    nextTick(() => scrollToActive())
  }
})
</script>

<template>
  <div
    ref="dropdownRef"
    class="cs"
    :class="{ 'cs--open': isOpen, 'cs--disabled': disabled, [`cs--${placement}`]: true }"
    @keydown="handleKeydown"
  >
    <div
      class="cs-trigger"
      tabindex="0"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-haspopup="'listbox'"
      @click="toggle"
    >
      <span class="cs-trigger__label">{{ selectedLabel }}</span>
      <svg class="cs-trigger__arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>

    <Transition name="cs-menu">
      <div
        v-if="isOpen"
        ref="listRef"
        class="cs-menu"
        role="listbox"
      >
        <div
          v-for="(option, index) in options"
          :key="option.value"
          class="cs-option"
          :class="{ 'cs-option--active': option.value === modelValue }"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="selectOption(option.value)"
        >
          {{ option.label }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.cs {
  position: relative;
  width: 100%;
}

.cs-trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  border: 1px solid rgba(146, 169, 214, 0.18);
  border-radius: 10px;
  background-color: rgba(12, 20, 36, 0.72);
  color: #edf3ff;
  font-size: 0.82rem;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.cs-trigger:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--provider-accent) 50%, rgba(146, 169, 214, 0.3));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--provider-accent) 12%, transparent);
}

.cs--open .cs-trigger {
  border-color: color-mix(in srgb, var(--provider-accent) 50%, rgba(146, 169, 214, 0.3));
  background-color: rgba(16, 26, 44, 0.82);
}

.cs-trigger__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
}

.cs-trigger__arrow {
  position: absolute;
  right: 0.65rem;
  top: 50%;
  transform: translateY(-50%);
  flex-shrink: 0;
  color: rgba(146, 169, 214, 0.5);
  transition: transform 0.15s ease;
  pointer-events: none;
}

.cs--open .cs-trigger__arrow {
  transform: translateY(-50%) rotate(180deg);
}

.cs-menu {
  position: absolute;
  left: 0;
  min-width: 100%;
  z-index: 1000;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid rgba(146, 169, 214, 0.2);
  border-radius: 10px;
  background-color: rgba(12, 20, 36, 0.96);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
}

.cs--bottom .cs-menu {
  top: calc(100% + 4px);
}

.cs--top .cs-menu {
  bottom: calc(100% + 4px);
}

.cs-menu::-webkit-scrollbar {
  width: 4px;
}

.cs-menu::-webkit-scrollbar-track {
  background: transparent;
}

.cs-menu::-webkit-scrollbar-thumb {
  background: rgba(146, 169, 214, 0.2);
  border-radius: 2px;
}

.cs-option {
  padding: 0.55rem 0.75rem;
  color: rgba(237, 243, 255, 0.78);
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.1s ease, color 0.1s ease;
}

.cs-option:hover {
  background-color: color-mix(in srgb, var(--provider-accent) 18%, rgba(255, 255, 255, 0.06));
  color: #edf3ff;
}

.cs-option--active {
  background-color: color-mix(in srgb, var(--provider-accent) 28%, rgba(255, 255, 255, 0.08));
  color: #edf3ff;
  font-weight: 500;
}

.cs-option--active:hover {
  background-color: color-mix(in srgb, var(--provider-accent) 35%, rgba(255, 255, 255, 0.1));
}

.cs--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.cs-menu-enter-active,
.cs-menu-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.cs-menu-enter-from,
.cs-menu-leave-to {
  opacity: 0;
}

.cs--bottom .cs-menu-enter-from,
.cs--bottom .cs-menu-leave-to {
  transform: translateY(-4px);
}

.cs--top .cs-menu-enter-from,
.cs--top .cs-menu-leave-to {
  transform: translateY(4px);
}
</style>
