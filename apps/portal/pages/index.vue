<template>
  <div class="home-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-icon">✨</span>
          <span class="badge-text">{{ t('common.appName') }}</span>
        </div>
        <h1 class="hero-title">
          {{ t('hero.title') }}
        </h1>
        <p class="hero-description">
          {{ t('hero.description') }}
        </p>
        <div class="hero-actions">
          <NuxtLink to="/register">
            <el-button type="primary" size="large" class="hero-btn primary">
              {{ t('hero.getStarted') }}
            </el-button>
          </NuxtLink>
          <NuxtLink to="/login">
            <el-button size="large" class="hero-btn">
              {{ t('nav.login') }}
            </el-button>
          </NuxtLink>
        </div>
      </div>
      <div class="hero-visual">
        <div class="visual-card card-1">
          <span class="card-emoji">🔐</span>
          <span class="card-label">{{ t('features.secure.title') }}</span>
        </div>
        <div class="visual-card card-2">
          <span class="card-emoji">⚡</span>
          <span class="card-label">{{ t('features.fast.title') }}</span>
        </div>
        <div class="visual-card card-3">
          <span class="card-emoji">🌐</span>
          <span class="card-label">{{ t('features.oauth.title') }}</span>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <h2 class="section-title">{{ t('features.title') }}</h2>
      <div class="features-grid">
        <div class="feature-card" v-for="feature in features" :key="feature.id">
          <div class="feature-icon">{{ feature.icon }}</div>
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-description">{{ feature.description }}</p>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="cta-card">
        <h3 class="cta-title">{{ t('cta.title') }}</h3>
        <p class="cta-description">{{ t('cta.description') }}</p>
        <NuxtLink to="/register">
          <el-button type="primary" size="large">
            {{ t('cta.button') }}
          </el-button>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// SEO
useHead({
  title: '4A User Center',
  meta: [
    { name: 'description', content: 'Secure authentication and user management platform' },
  ],
})

// Feature cards data
const features = computed(() => [
  {
    id: 'secure',
    icon: '🔐',
    title: t('features.secure.title'),
    description: t('features.secure.description'),
  },
  {
    id: 'oauth',
    icon: '🌐',
    title: t('features.oauth.title'),
    description: t('features.oauth.description'),
  },
  {
    id: 'fast',
    icon: '⚡',
    title: t('features.fast.title'),
    description: t('features.fast.description'),
  },
  {
    id: 'abac',
    icon: '🛡️',
    title: t('features.abac.title'),
    description: t('features.abac.description'),
  },
])
</script>

<style scoped>
.home-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Hero Section */
.hero-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  padding: 60px 0 80px;
  align-items: center;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(103, 194, 58, 0.1) 100%);
  border-radius: 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(64, 158, 255, 0.15);
}

.badge-icon {
  font-size: 14px;
}

.badge-text {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
}

.hero-title {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.2;
  color: #303133;
  margin: 0 0 20px;
  letter-spacing: -1px;
}

.hero-description {
  font-size: 18px;
  line-height: 1.6;
  color: #606266;
  margin: 0 0 32px;
  max-width: 480px;
}

.hero-actions {
  display: flex;
  gap: 12px;
}

.hero-btn {
  min-width: 140px;
  height: 48px;
  font-weight: 600;
  border-radius: 10px;
}

.hero-btn.primary {
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.35);
}

/* Hero Visual */
.hero-visual {
  position: relative;
  height: 360px;
}

.visual-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 28px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.05);
  animation: float 4s ease-in-out infinite;
}

.visual-card .card-emoji {
  font-size: 32px;
}

.visual-card .card-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.card-1 {
  top: 20px;
  left: 40px;
  animation-delay: 0s;
}

.card-2 {
  top: 120px;
  right: 20px;
  animation-delay: 0.5s;
}

.card-3 {
  bottom: 40px;
  left: 80px;
  animation-delay: 1s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}

/* Features Section */
.features-section {
  padding: 60px 0;
}

.section-title {
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  color: #303133;
  margin: 0 0 48px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.feature-card {
  padding: 32px 24px;
  background: white;
  border-radius: 16px;
  text-align: center;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
}

.feature-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.feature-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px;
}

.feature-description {
  font-size: 14px;
  line-height: 1.6;
  color: #909399;
  margin: 0;
}

/* CTA Section */
.cta-section {
  padding: 60px 0 80px;
}

.cta-card {
  text-align: center;
  padding: 60px 40px;
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  border-radius: 24px;
  color: white;
}

.cta-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 16px;
}

.cta-description {
  font-size: 18px;
  opacity: 0.9;
  margin: 0 0 32px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* Responsive */
@media (max-width: 900px) {
  .hero-section {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 40px;
  }

  .hero-description {
    max-width: none;
  }

  .hero-actions {
    justify-content: center;
  }

  .hero-visual {
    height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
  }

  .visual-card {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    bottom: auto;
  }

  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .hero-title {
    font-size: 32px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .cta-card {
    padding: 40px 24px;
  }

  .cta-title {
    font-size: 24px;
  }
}
</style>
