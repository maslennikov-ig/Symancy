export const translations = {
  en: {
    'header.title': 'Coffee Psychologist',
    'header.subtitle': 'Your personal guide to self-discovery through coffee grounds patterns',
    'uploader.title': 'Upload a photo of your coffee cup',
    'uploader.subtitle': 'Drag and drop the file here or click to select',
    'uploader.tip.title': 'Tips for the best results:',
    'uploader.tip.1': 'Take the photo in good, even lighting.',
    'uploader.tip.2': 'Focus on the inside of the cup with the grounds.',
    'uploader.tip.3': 'Try to ensure there is no glare on the image.',
    'imageReady.title': 'Your cup is ready for analysis',
    'imageReady.focus.title': 'What to focus on?',
    'imageReady.focus.wellbeing': 'General Well-being',
    'imageReady.focus.career': 'Career',
    'imageReady.focus.relationships': 'Relationships',
    'button.analyze': 'Analyze',
    'button.reset': 'Reset',
    'loader.message': 'Studying the patterns in the coffee grounds...',
    'error.analyzeFailed': 'Failed to analyze the image. Please try again.',
    'error.tryAgain': 'Try Again',
    'error.selectImage': 'Please select an image first.',
    'result.title': 'Your Psychological Profile',
    'result.button.share': 'Share',
    'result.button.analyzeAnother': 'Analyze another cup',
    'share.title': 'My Coffee Analysis',
    'share.text': 'Here\'s what my coffee cup revealed:',
    'share.error': 'Failed to share image. Please try again.',
    'share.image.footer': 'Analysis created with Coffee Psychologist',
    'footer.copyright': '© {year} Coffee Psychologist. All rights reserved.',
    'footer.disclaimer': 'Remember, this is just a tool for self-discovery.',
    'mobileMenu.language': 'Language',
    'mobileMenu.theme': 'Theme',
    'mobileMenu.light': 'Light',
    'mobileMenu.dark': 'Dark',
  },
  ru: {
    'header.title': 'Кофейный Психолог',
    'header.subtitle': 'Ваш личный гид по самопознанию через узоры на кофейной гуще',
    'uploader.title': 'Загрузите фото вашей кофейной чашки',
    'uploader.subtitle': 'Перетащите файл сюда или нажмите для выбора',
    'uploader.tip.title': 'Советы для лучшего результата:',
    'uploader.tip.1': 'Сделайте фото при хорошем, ровном освещении.',
    'uploader.tip.2': 'Сфокусируйтесь на внутренней части чашки с гущей.',
    'uploader.tip.3': 'Постарайтесь, чтобы на изображении не было бликов.',
    'imageReady.title': 'Ваша чашка готова к анализу',
    'imageReady.focus.title': 'На чем сфокусироваться?',
    'imageReady.focus.wellbeing': 'Общее самочувствие',
    'imageReady.focus.career': 'Карьера',
    'imageReady.focus.relationships': 'Отношения',
    'button.analyze': 'Анализировать',
    'button.reset': 'Сбросить',
    'loader.message': 'Изучаю узоры на кофейной гуще...',
    'error.analyzeFailed': 'Не удалось проанализировать изображение. Пожалуйста, попробуйте еще раз.',
    'error.tryAgain': 'Попробовать снова',
    'error.selectImage': 'Пожалуйста, сначала выберите изображение.',
    'result.title': 'Ваш Психологический Портрет',
    'result.button.share': 'Поделиться',
    'result.button.analyzeAnother': 'Проанализировать еще одну чашку',
    'share.title': 'Мой кофейный анализ',
    'share.text': 'Вот что рассказала моя кофейная чашка:',
    'share.error': 'Не удалось поделиться изображением. Пожалуйста, попробуйте еще раз.',
    'share.image.footer': 'Анализ создан с помощью Coffee Psychologist',
    'footer.copyright': '© {year} Кофейный Психолог. Все права защищены.',
    'footer.disclaimer': 'Помните, это лишь инструмент для самопознания.',
    'mobileMenu.language': 'Язык',
    'mobileMenu.theme': 'Тема',
    'mobileMenu.light': 'Светлая',
    'mobileMenu.dark': 'Тёмная',
  },
  zh: {
    'header.title': '咖啡心理学家',
    'header.subtitle': '通过咖啡渣图案进行自我发现的个人向导',
    'uploader.title': '上传您的咖啡杯照片',
    'uploader.subtitle': '将文件拖放到此处或点击选择',
    'uploader.tip.title': '为获得最佳结果的提示:',
    'uploader.tip.1': '在良好、均匀的光线下拍照。',
    'uploader.tip.2': '聚焦于杯子内部的咖啡渣。',
    'uploader.tip.3': '尽量确保图像中没有眩光。',
    'imageReady.title': '您的杯子已准备好进行分析',
    'imageReady.focus.title': '关注什么？',
    'imageReady.focus.wellbeing': '总体健康',
    'imageReady.focus.career': '职业',
    'imageReady.focus.relationships': '人际关系',
    'button.analyze': '分析',
    'button.reset': '重置',
    'loader.message': '正在研究咖啡渣中的图案...',
    'error.analyzeFailed': '分析图像失败。请重试。',
    'error.tryAgain': '再试一次',
    'error.selectImage': '请先选择一张图片。',
    'result.title': '您的心理画像',
    'result.button.share': '分享',
    'result.button.analyzeAnother': '分析另一个杯子',
    'share.title': '我的咖啡分析',
    'share.text': '这是我的咖啡杯揭示的内容：',
    'share.error': '分享图片失败。请再试一次。',
    'share.image.footer': '由咖啡心理学家创建的分析',
    'footer.copyright': '© {year} 咖啡心理学家. 版权所有.',
    'footer.disclaimer': '请记住，这只是一个自我探索的工具。',
    'mobileMenu.language': '语言',
    'mobileMenu.theme': '主题',
    'mobileMenu.light': '浅色',
    'mobileMenu.dark': '深色',
  },
};

export type Lang = keyof typeof translations;

export const t = (key: keyof typeof translations.en, lang: Lang): string => {
  return translations[lang][key] || translations.en[key] || key;
};

export const detectInitialLanguage = (): Lang => {
  if (typeof window === 'undefined') return 'en';
  
  const savedLang = localStorage.getItem('language');
  if (savedLang && translations.hasOwnProperty(savedLang)) {
    return savedLang as Lang;
  }

  const browserLang = navigator.language.split('-')[0];
  if (translations.hasOwnProperty(browserLang)) {
    return browserLang as Lang;
  }
  
  return 'en';
};