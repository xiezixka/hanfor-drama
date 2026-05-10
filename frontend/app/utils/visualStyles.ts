export const visualStyleOptions = [
  { value: 'realistic', label: '写实' },
  { value: 'anime', label: '动漫' },
  { value: 'ghibli', label: '吉卜力' },
  { value: 'cinematic', label: '电影感' },
  { value: 'comic', label: '漫画' },
  { value: 'watercolor', label: '水彩' },
]

const visualStyleLabelMap = Object.fromEntries(
  visualStyleOptions.map((option) => [option.value, option.label]),
)

export function getVisualStyleLabel(style?: string | null) {
  if (!style) return ''
  return visualStyleLabelMap[style] || style
}
