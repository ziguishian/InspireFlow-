/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 强调色（随设置切换 cyan/blue/purple/green）
        'accent': 'rgb(var(--accent-primary))',
        'accent-glow': 'var(--accent-glow)',
        // Diffusion Style Palette（使用 CSS 变量以支持 data-theme 切换）
        'diffusion': {
          'bg': 'var(--diffusion-bg, #0a0a0f)',
          'bg-secondary': 'var(--diffusion-bg-secondary, #12121a)',
          'bg-tertiary': 'var(--diffusion-bg-tertiary, #1a1a24)',
          'border': 'var(--diffusion-border, rgba(100, 150, 255, 0.1))',
          'border-30': 'rgba(100, 150, 255, 0.3)',
          'border-50': 'rgba(100, 150, 255, 0.5)',
          'border-60': 'rgba(100, 150, 255, 0.6)',
          'border-hover': 'rgba(100, 150, 255, 0.3)',
          'glow-blue': '#3b82f6',
          'glow-purple': '#8b5cf6',
          'glow-cyan': '#06b6d4',
          'text-primary': 'var(--diffusion-text-primary, #e5e7eb)',
          'text-secondary': 'var(--diffusion-text-secondary, #9ca3af)',
          'text-muted': 'var(--diffusion-text-muted, #6b7280)',
        },
      },
      backgroundImage: {
        'gradient-diffusion': 'radial-gradient(ellipse at top, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 50%, transparent 100%)',
        'gradient-diffusion-strong': 'radial-gradient(ellipse at top, rgba(59, 130, 246, 0.25) 0%, rgba(139, 92, 246, 0.15) 50%, transparent 100%)',
      },
      backdropBlur: {
        'glass': '12px',
        'glass-strong': '20px',
      },
      boxShadow: {
        'node-premium': '0 8px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'node-premium-selected': '0 10px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(var(--accent-primary), 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'node-premium-blue': '0 10px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'node-premium-purple': '0 10px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
}
