# 🎨 Guia de Identidade Visual - Flow LAB

> Documentação completa do sistema de design e estilização utilizado no Flow LAB para replicação em outros projetos.

---

## 📋 Índice

1. [Paleta de Cores](#-paleta-de-cores)
2. [Tipografia](#-tipografia)
3. [Espaçamento e Layout](#-espaçamento-e-layout)
4. [Componentes UI](#-componentes-ui)
5. [Animações e Transições](#-animações-e-transições)
6. [Efeitos Especiais](#-efeitos-especiais)
7. [Responsividade](#-responsividade)
8. [Classes Utilitárias Customizadas](#-classes-utilitárias-customizadas)
9. [Padrões de Código](#-padrões-de-código)

---

## 🎨 Paleta de Cores

### Cores Principais (Primárias)

| Cor | Classe Tailwind | Hex | Uso |
|-----|-----------------|-----|-----|
| Blue 900 | `blue-900` | `#1e3a8a` | Texto principal, gradientes de destaque |
| Blue 700 | `blue-700` | `#1d4ed8` | Gradientes, hovers |
| Blue 600 | `blue-600` | `#2563eb` | Links, bordas ativas |
| Blue 500 | `blue-500` | `#3b82f6` | Botões primários, elementos de navegação ativos |
| Indigo 800 | `indigo-800` | `#3730a3` | Gradientes secundários |
| Indigo 500 | `indigo-500` | `#6366f1` | Acentos |

### Cores de Fundo

| Cor | Classe Tailwind | Uso |
|-----|-----------------|-----|
| Slate 50 | `slate-50` | Background de página |
| Blue 50 | `blue-50` | Background de destaque sutil |
| Indigo 50 | `indigo-50` | Background de cards destacados |
| Gray 50 | `gray-50` | Background de seções |
| White | `white` | Cards e modais |

### Cores de Estado

| Estado | Classes | Uso |
|--------|---------|-----|
| **Sucesso** | `green-50`, `green-100`, `green-500`, `green-600`, `green-800` | Notificações, badges, botões de confirmação |
| **Erro** | `red-50`, `red-100`, `red-500`, `red-600`, `red-800` | Alertas, badges de erro, botões de exclusão |
| **Alerta** | `yellow-50`, `yellow-100`, `yellow-500`, `yellow-600`, `yellow-800` | Avisos, badges de warning |
| **Info** | `blue-50`, `blue-100`, `blue-500`, `blue-600`, `blue-800` | Informações, dicas |
| **Neutro** | `gray-400`, `gray-500`, `gray-600`, `gray-700`, `gray-800` | Texto, ícones, bordas |

### Gradientes Principais

```css
/* Gradiente Principal (Background Auth) */
bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50

/* Gradiente de Botão Primário */
bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800

/* Gradiente de Texto (Logo/Título) */
bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 bg-clip-text text-transparent

/* Gradiente de Header Sidebar */
bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50

/* Gradiente de Navegação Ativa */
bg-gradient-to-r from-blue-500 to-blue-600

/* Gradiente Danger */
bg-gradient-to-r from-red-600 to-red-700

/* Gradiente de Logout */
bg-gradient-to-r from-red-500 to-rose-500
```

---

## 📝 Tipografia

### Hierarquia de Texto

| Elemento | Classes |
|----------|---------|
| **Título Principal (H1)** | `text-3xl font-bold` |
| **Título Secundário (H2)** | `text-lg font-semibold text-gray-800` |
| **Subtítulo** | `text-sm font-semibold text-gray-700` |
| **Texto Corpo** | `text-sm text-gray-600` |
| **Texto Secundário** | `text-xs text-gray-500` |
| **Labels** | `text-sm font-medium text-slate-700` |
| **Badges** | `text-xs font-medium` |

### Estilos de Título com Gradiente

```jsx
<h1 className="text-3xl font-bold">
  <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 bg-clip-text text-transparent">
    Flow LAB
  </span>
</h1>
```

---

## 📐 Espaçamento e Layout

### Sistema de Grid

```jsx
/* Grid responsivo para cards */
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6

/* Grid de dashboard */
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6
```

### Padding e Margin

| Contexto | Classes |
|----------|---------|
| **Container de página** | `py-4 px-4 sm:px-6 lg:px-8` |
| **Cards** | `p-6` |
| **Modais** | `p-4` ou `px-6 py-5` |
| **Inputs** | `px-4 py-3` |
| **Botões** | `px-4 py-2.5` ou `px-5 py-2.5` |
| **Badges** | `px-2 py-1` |
| **Ícones em círculo** | `p-2` |

### Border Radius

| Elemento | Classes |
|----------|---------|
| **Cards** | `rounded-2xl` |
| **Modais** | `rounded-2xl` ou `rounded-3xl` |
| **Botões** | `rounded-xl` |
| **Inputs** | `rounded-xl` |
| **Badges** | `rounded-full` |
| **Ícones/Avatares** | `rounded-xl` ou `rounded-full` |
| **Scrollbar** | `rounded` (4px) |

---

## 🧩 Componentes UI

### Botões

#### Botão Primário
```jsx
<button className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 
  text-white font-medium rounded-xl shadow-md shadow-blue-500/25 
  hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 
  transition-all duration-200">
  Ação Principal
</button>
```

#### Botão Secundário
```jsx
<button className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 
  rounded-xl hover:bg-gray-50 hover:border-gray-300 
  transition-all duration-200 font-medium">
  Cancelar
</button>
```

#### Botão de Perigo
```jsx
<button className="px-5 py-2.5 rounded-xl transition-all duration-200 font-medium 
  bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 
  text-white shadow-lg shadow-red-500/25 hover-lift">
  Excluir
</button>
```

#### Botão com Shimmer Effect
```jsx
<button className="relative overflow-hidden group">
  <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 
    transition-all duration-300 group-hover:scale-105"></div>
  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 
    bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.15)_50%,transparent_75%)] 
    bg-[length:250%_250%] animate-shimmer"></div>
  <span className="relative z-10 flex items-center text-white">Enviar</span>
</button>
```

### Inputs

#### Input Padrão
```jsx
<input className="w-full px-4 py-3 border border-slate-200 rounded-xl 
  focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 
  transition-all duration-200 hover:border-slate-300 
  bg-white/70 backdrop-blur-sm text-slate-800 placeholder:text-slate-400" />
```

#### Select
```jsx
<select className="w-full px-4 py-3 border border-slate-200 rounded-xl 
  focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 
  transition-all duration-200 hover:border-slate-300 
  bg-white/70 backdrop-blur-sm text-slate-800 cursor-pointer">
```

### Cards

#### Card Básico
```jsx
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
  {/* Conteúdo */}
</div>
```

#### Card Interativo
```jsx
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 
  card-interactive hover:shadow-lg">
  {/* Conteúdo */}
</div>
```

#### Card com Glassmorphism
```jsx
<div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl 
  shadow-slate-900/10 p-8 border border-slate-200/50">
  {/* Conteúdo */}
</div>
```

### Badges

#### Badge de Status
```jsx
/* Ativo */
<span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Ativo</span>

/* Estoque Baixo */
<span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">Estoque Baixo</span>

/* Vencido */
<span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Vencido</span>
```

### Modais

#### Estrutura de Modal
```jsx
{/* Overlay */}
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center 
  p-4 z-50 animate-fade-in">
  
  {/* Container do Modal */}
  <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
    
    {/* Header */}
    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-800">Título</h2>
      <button className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 
        p-1.5 rounded-full transition-all duration-200 hover:rotate-90">
        <X className="w-5 h-5" />
      </button>
    </div>
    
    {/* Corpo */}
    <div className="px-6 py-5">
      {/* Conteúdo */}
    </div>
    
    {/* Footer */}
    <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end space-x-3">
      {/* Botões */}
    </div>
  </div>
</div>
```

### Notificações

```jsx
/* Container */
<div className="fixed top-4 right-4 z-50 animate-slide-in-right">
  <div className="max-w-md w-full border rounded-xl shadow-lg p-4 backdrop-blur-sm 
    bg-green-50 border-green-300 text-green-800 shadow-green-100">
    {/* Conteúdo */}
  </div>
</div>
```

### Sidebar / Navegação

#### Item de Navegação Ativo
```jsx
<Link className="flex items-center px-3 py-2.5 text-sm font-medium rounded-xl 
  bg-gradient-to-r from-blue-500 to-blue-600 text-white 
  shadow-md shadow-blue-500/25">
  <Icon className="mr-3 h-5 w-5" />
  Nome do Item
</Link>
```

#### Item de Navegação Inativo
```jsx
<Link className="flex items-center px-3 py-2.5 text-sm font-medium rounded-xl 
  text-gray-600 hover:bg-gray-100 hover:text-gray-900 
  transition-all duration-200">
  <Icon className="mr-3 h-5 w-5" />
  Nome do Item
</Link>
```

### Tabelas

```jsx
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
        Coluna
      </th>
    </tr>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        Valor
      </td>
    </tr>
  </tbody>
</table>
```

---

## ✨ Animações e Transições

### Classes de Animação Customizadas

```css
/* Fade In */
.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

/* Fade In Up (para stagger) */
.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out forwards;
}

/* Fade In Down */
.animate-fade-in-down {
  animation: fadeInDown 0.3s ease-out forwards;
}

/* Scale In (modais) */
.animate-scale-in {
  animation: scaleIn 0.2s ease-out forwards;
}

/* Slide In Right (notificações) */
.animate-slide-in-right {
  animation: slideInRight 0.3s ease-out forwards;
}

/* Slide In Left */
.animate-slide-in-left {
  animation: slideInLeft 0.3s ease-out forwards;
}

/* Slide Up */
.animate-slide-up {
  animation: slideUp 0.3s ease-out forwards;
}

/* Bounce In */
.animate-bounce-in {
  animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
}

/* Pulse Suave */
.animate-pulse-soft {
  animation: pulseSoft 2s ease-in-out infinite;
}

/* Shimmer (loading) */
.animate-shimmer {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* Blob (background decorativo) */
.animate-blob {
  animation: blob 7s infinite ease-in-out;
}

/* Spin Lento */
.animate-spin-slow {
  animation: spin 8s linear infinite;
}

/* Shake (erro) */
.animate-shake {
  animation: shake 0.5s ease-in-out;
}
```

### Stagger Delays

```css
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }
```

### Animation Delays para Blobs

```css
.animation-delay-2000 { animation-delay: 2s; }
.animation-delay-4000 { animation-delay: 4s; }
```

### Transições Padrão

```jsx
/* Transição suave universal */
transition-all duration-200

/* Transição com easing customizado */
transition-all duration-300 ease-out

/* Transição de cores */
transition-colors duration-200

/* Transição de transform */
transition-transform duration-300
```

### Hover Effects

```css
/* Elevação no hover */
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Glow no hover */
.hover-glow:hover {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}

/* Rotação no hover (ícone de fechar) */
hover:rotate-90

/* Escala no hover */
hover:scale-110
hover:scale-105

/* Translação no hover */
hover:translate-x-1
```

---

## 🪄 Efeitos Especiais

### Glassmorphism

```jsx
/* Glass básico */
<div className="bg-white/70 backdrop-blur-sm">

/* Glass forte */
<div className="bg-white/80 backdrop-blur-2xl">

/* Glass com borda */
<div className="bg-white/80 backdrop-blur-2xl border border-slate-200/50">
```

### Sombras

```jsx
/* Sombra sutil */
shadow-sm

/* Sombra padrão */
shadow-md

/* Sombra grande */
shadow-lg

/* Sombra extra grande */
shadow-xl shadow-2xl

/* Sombras coloridas */
shadow-md shadow-blue-500/25
shadow-lg shadow-red-500/25
shadow-lg shadow-green-500/25

/* Sombra de página de login */
shadow-2xl shadow-slate-900/10
```

### Glow Effects

```jsx
/* Glow sutil atrás de card */
<div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-slate-500/10 rounded-3xl blur-xl -z-10"></div>
```

### Background Decorativo (Orbs Animados)

```jsx
/* Orbs para página de login */
<div className="absolute top-1/4 -left-20 w-96 h-96 bg-gradient-to-r from-blue-200/50 to-cyan-200/50 rounded-full blur-3xl animate-blob"></div>
<div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-gradient-to-r from-indigo-200/50 to-blue-200/50 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
```

### Grid Pattern Overlay

```jsx
<div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,138,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,138,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
```

### Skeleton Loading

```jsx
<div className="skeleton h-4 w-24 bg-gray-200 rounded"></div>
```

```css
.skeleton {
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 0.375rem;
}
```

### Borda Rotativa (Logo)

```jsx
<div className="absolute w-28 h-28 rounded-full border-2 border-transparent animate-spin-slow" 
  style={{ 
    background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #1e3a8a, #3b82f6, #1e40af) border-box', 
    animationDuration: '8s' 
  }}>
</div>
```

---

## 📱 Responsividade

### Breakpoints (Tailwind Padrão)

| Breakpoint | Prefixo | Tamanho |
|------------|---------|---------|
| Mobile | (padrão) | < 640px |
| Small | `sm:` | ≥ 640px |
| Medium | `md:` | ≥ 768px |
| Large | `lg:` | ≥ 1024px |
| Extra Large | `xl:` | ≥ 1280px |

### Padrões de Grid Responsivo

```jsx
/* Cards de dashboard */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-4

/* Lista de produtos */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4

/* Gap responsivo */
gap-4 sm:gap-6
```

### Sidebar Responsiva

```jsx
/* Mobile: sidebar com overlay */
<div className="fixed inset-0 z-50 lg:hidden">

/* Desktop: sidebar fixa */
<div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64">
```

### Mobile Utilities

```css
/* Viewport height dinâmico */
@supports (height: 100dvh) {
  .min-h-screen { min-height: 100dvh; }
  .h-screen { height: 100dvh; }
}

/* Safe area insets (notch) */
.safe-area-top { padding-top: env(safe-area-inset-top); }
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }

/* Touch targets mínimos */
@media (pointer: coarse) {
  button, a, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
}
```

---

## 🛠 Classes Utilitárias Customizadas

### Adicione ao seu `index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  /* ========== ANIMAÇÕES ========== */
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.4s ease-out forwards;
  }
  .animate-fade-in-down {
    animation: fadeInDown 0.3s ease-out forwards;
  }
  .animate-scale-in {
    animation: scaleIn 0.2s ease-out forwards;
  }
  .animate-slide-in-right {
    animation: slideInRight 0.3s ease-out forwards;
  }
  .animate-slide-in-left {
    animation: slideInLeft 0.3s ease-out forwards;
  }
  .animate-slide-up {
    animation: slideUp 0.3s ease-out forwards;
  }
  .animate-bounce-in {
    animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
  }
  .animate-pulse-soft {
    animation: pulseSoft 2s ease-in-out infinite;
  }
  .animate-shimmer {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  .animate-blob {
    animation: blob 7s infinite ease-in-out;
  }
  .animate-spin-slow {
    animation: spin 8s linear infinite;
  }
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }

  /* ========== HOVER EFFECTS ========== */
  .hover-lift {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -5px rgba(0, 0, 0, 0.04);
  }
  .hover-glow:hover {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
  }

  /* ========== GLASS EFFECT ========== */
  .glass {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  /* ========== CARDS ========== */
  .card-interactive {
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .card-interactive:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  /* ========== FOCUS RING ========== */
  .focus-ring {
    outline: none;
  }
  .focus-ring:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.5);
    outline-offset: 2px;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  /* ========== TEXT GRADIENT ========== */
  .text-gradient {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ========== SKELETON ========== */
  .skeleton {
    background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 0.375rem;
  }

  /* ========== STAGGER DELAYS ========== */
  .stagger-1 { animation-delay: 0.05s; }
  .stagger-2 { animation-delay: 0.1s; }
  .stagger-3 { animation-delay: 0.15s; }
  .stagger-4 { animation-delay: 0.2s; }
  .stagger-5 { animation-delay: 0.25s; }
  
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }

  /* ========== NO SELECT ========== */
  .no-select {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
}

/* ========== KEYFRAMES ========== */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(100%); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes pulseSoft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes badgePulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0; }
}

@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20px, -30px) scale(1.1); }
  50% { transform: translate(-20px, 20px) scale(0.9); }
  75% { transform: translate(30px, 10px) scale(1.05); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ========== SCROLLBAR CUSTOMIZADA ========== */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
  transition: background 0.2s;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* ========== SELECTION ========== */
::selection {
  background: rgba(59, 130, 246, 0.2);
  color: inherit;
}

/* ========== GLOBAL IMPROVEMENTS ========== */
html {
  scroll-behavior: smooth;
}

* {
  -webkit-tap-highlight-color: transparent;
}

input, select, textarea {
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

button {
  transition: all 0.15s ease;
}

button:active:not(:disabled) {
  transform: scale(0.98);
}

a {
  transition: color 0.2s ease;
}

tr {
  transition: background-color 0.15s ease;
}

.loading {
  pointer-events: none;
  opacity: 0.7;
}

:disabled, .disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ========== MOBILE UTILITIES ========== */
@supports (height: 100dvh) {
  .min-h-screen { min-height: 100dvh; }
  .h-screen { height: 100dvh; }
}

@supports (padding-top: env(safe-area-inset-top)) {
  .safe-area-top { padding-top: env(safe-area-inset-top); }
  .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
  .safe-area-left { padding-left: env(safe-area-inset-left); }
  .safe-area-right { padding-right: env(safe-area-inset-right); }
}

html, body {
  overscroll-behavior: none;
}

@media (pointer: coarse) {
  button, a, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
}

.fixed {
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}
```

---

## 📋 Padrões de Código

### Estrutura de Componente

```tsx
import React, { useState } from 'react';
import { Icon1, Icon2 } from 'lucide-react';

interface ComponentProps {
  prop1: string;
  prop2?: number;
}

const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  const [state, setState] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in">
      {/* Conteúdo */}
    </div>
  );
};

export default Component;
```

### Ícones (Lucide React)

```bash
npm install lucide-react
```

Ícones mais usados:
- `Package`, `Plus`, `Minus`, `Edit`, `Trash2`, `Save`, `X`
- `Search`, `Filter`, `ArrowUpDown`
- `AlertTriangle`, `CheckCircle`, `XCircle`, `Info`
- `ChevronDown`, `ChevronRight`, `ArrowUpRight`, `ArrowDownRight`
- `LogIn`, `LogOut`, `User`, `Users`, `Shield`
- `Menu`, `LayoutDashboard`, `History`, `Calendar`, `Clock`
- `Eye`, `EyeOff`, `Loader2`

### Dependências Essenciais

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-router-dom": "^6.x",
    "lucide-react": "^0.x",
    "tailwindcss": "^3.x"
  }
}
```

---

## 🎯 Resumo Rápido

### Cores Principais
- **Primária:** `blue-500` a `blue-900`
- **Secundária:** `indigo-500` a `indigo-800`
- **Background:** `slate-50`, `gray-50`, `white`

### Border Radius
- Cards: `rounded-2xl`
- Botões/Inputs: `rounded-xl`
- Badges: `rounded-full`

### Sombras
- Cards: `shadow-sm` + `shadow-md shadow-blue-500/25` para destaques
- Modais: `shadow-2xl`

### Animações Principais
- Entrada: `animate-fade-in`, `animate-scale-in`
- Notificações: `animate-slide-in-right`
- Loading: `animate-shimmer`, `skeleton`

### Transições
- Padrão: `transition-all duration-200`
- Hover: `hover-lift`, `hover:scale-105`

---

> 📌 **Dica:** Copie o conteúdo da seção "Classes Utilitárias Customizadas" diretamente para o `index.css` do seu novo projeto para ter todas as animações e efeitos disponíveis.
