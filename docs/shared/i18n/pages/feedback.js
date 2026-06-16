/**
 * shared/i18n/pages/feedback.js — Catalogue i18n de la page « Contact » (feedback.html).
 * Enregistre les clés feedback.* dans les 5 langues. FR = référence/repli.
 */
(function () {
  'use strict';
  if (!window.ANEF || !ANEF.i18n) { return; }

  ANEF.i18n.register('fr', {
    'feedback.page_title': 'ANEF Stats — Contact et retours',
    'feedback.meta_description': "Signalez un problème ou envoyez vos retours sur ANEF Status Tracker, l'extension Chrome de suivi de naturalisation française.",
    'feedback.hero_title': 'Signaler un bug ou proposer une idée',
    'feedback.hero_desc': "Vous avez trouvé un bug ? Vous avez une suggestion d'amélioration ou une fonctionnalité à proposer ? Rejoignez notre groupe Facebook pour en discuter avec la communauté !",
    'feedback.cta_facebook': 'Rejoindre le groupe Facebook',
    'feedback.cards_intro': "Le groupe est l'endroit idéal pour :",
    'feedback.card_bug_title': 'Signaler un bug',
    'feedback.card_bug_desc': 'Un affichage incorrect, une erreur, un plantage',
    'feedback.card_idea_title': 'Proposer une idée',
    'feedback.card_idea_desc': 'De nouvelles fonctionnalités ou améliorations',
    'feedback.card_fix_title': 'Demander une correction',
    'feedback.card_fix_desc': 'Des données incorrectes, des textes à modifier',
    'feedback.card_chat_title': 'Échanger',
    'feedback.card_chat_desc': 'Discuter avec la communauté'
  });

  ANEF.i18n.register('en', {
    'feedback.page_title': 'ANEF Stats — Contact and feedback',
    'feedback.meta_description': 'Report a problem or send your feedback about ANEF Status Tracker, the Chrome extension for tracking French naturalisation applications.',
    'feedback.hero_title': 'Report a bug or suggest an idea',
    'feedback.hero_desc': 'Found a bug? Have a suggestion for improvement or a feature to propose? Join our Facebook group to discuss it with the community!',
    'feedback.cta_facebook': 'Join the Facebook group',
    'feedback.cards_intro': 'The group is the perfect place to:',
    'feedback.card_bug_title': 'Report a bug',
    'feedback.card_bug_desc': 'An incorrect display, an error, a crash',
    'feedback.card_idea_title': 'Suggest an idea',
    'feedback.card_idea_desc': 'New features or improvements',
    'feedback.card_fix_title': 'Request a correction',
    'feedback.card_fix_desc': 'Incorrect data, text to be changed',
    'feedback.card_chat_title': 'Chat',
    'feedback.card_chat_desc': 'Talk with the community'
  });

  ANEF.i18n.register('es', {
    'feedback.page_title': 'ANEF Stats — Contacto y comentarios',
    'feedback.meta_description': 'Informa de un problema o envía tus comentarios sobre ANEF Status Tracker, la extensión de Chrome para seguir tu solicitud de nacionalidad francesa.',
    'feedback.hero_title': 'Informar de un error o proponer una idea',
    'feedback.hero_desc': '¿Has encontrado un error? ¿Tienes una sugerencia de mejora o una función que proponer? ¡Únete a nuestro grupo de Facebook para comentarlo con la comunidad!',
    'feedback.cta_facebook': 'Unirse al grupo de Facebook',
    'feedback.cards_intro': 'El grupo es el lugar ideal para:',
    'feedback.card_bug_title': 'Informar de un error',
    'feedback.card_bug_desc': 'Una visualización incorrecta, un error, un fallo',
    'feedback.card_idea_title': 'Proponer una idea',
    'feedback.card_idea_desc': 'Nuevas funciones o mejoras',
    'feedback.card_fix_title': 'Solicitar una corrección',
    'feedback.card_fix_desc': 'Datos incorrectos, textos que modificar',
    'feedback.card_chat_title': 'Intercambiar',
    'feedback.card_chat_desc': 'Hablar con la comunidad'
  });

  ANEF.i18n.register('ar', {
    'feedback.page_title': 'ANEF Stats — التواصل والملاحظات',
    'feedback.meta_description': 'أبلغ عن مشكلة أو أرسل ملاحظاتك حول ANEF Status Tracker، إضافة Chrome لمتابعة طلب التجنّس الفرنسي.',
    'feedback.hero_title': 'الإبلاغ عن خلل أو اقتراح فكرة',
    'feedback.hero_desc': 'هل وجدت خللاً؟ هل لديك اقتراح للتحسين أو ميزة تودّ اقتراحها؟ انضمّ إلى مجموعتنا على Facebook لمناقشة ذلك مع المجتمع!',
    'feedback.cta_facebook': 'الانضمام إلى مجموعة Facebook',
    'feedback.cards_intro': 'المجموعة هي المكان المثالي لـ:',
    'feedback.card_bug_title': 'الإبلاغ عن خلل',
    'feedback.card_bug_desc': 'عرض غير صحيح أو خطأ أو تعطّل',
    'feedback.card_idea_title': 'اقتراح فكرة',
    'feedback.card_idea_desc': 'ميزات جديدة أو تحسينات',
    'feedback.card_fix_title': 'طلب تصحيح',
    'feedback.card_fix_desc': 'بيانات غير صحيحة أو نصوص بحاجة إلى تعديل',
    'feedback.card_chat_title': 'التبادل',
    'feedback.card_chat_desc': 'التحدّث مع المجتمع'
  });

  ANEF.i18n.register('zh', {
    'feedback.page_title': 'ANEF Stats — 联系与反馈',
    'feedback.meta_description': '报告问题或就 ANEF Status Tracker（用于跟踪法国入籍申请的 Chrome 扩展程序）发送您的反馈。',
    'feedback.hero_title': '报告错误或提出想法',
    'feedback.hero_desc': '发现了错误？有改进建议或想提议的功能？加入我们的 Facebook 群组，与社区一起讨论吧！',
    'feedback.cta_facebook': '加入 Facebook 群组',
    'feedback.cards_intro': '该群组是以下用途的理想场所：',
    'feedback.card_bug_title': '报告错误',
    'feedback.card_bug_desc': '显示不正确、出错或崩溃',
    'feedback.card_idea_title': '提出想法',
    'feedback.card_idea_desc': '新功能或改进',
    'feedback.card_fix_title': '请求更正',
    'feedback.card_fix_desc': '数据不正确、需修改的文本',
    'feedback.card_chat_title': '交流',
    'feedback.card_chat_desc': '与社区讨论'
  });
})();
