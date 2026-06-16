/* shared/i18n/pages/guide.js — Catalogue i18n de la page Guide.
   Clés préfixées « guide.* ». FR = référence/repli. */
(function(){ 'use strict';
  if(!window.ANEF||!ANEF.i18n){return;}

  /* ---------------------------------------------------------------- FR */
  ANEF.i18n.register('fr', {
    'guide.s1.title': "Qu'est-ce que ANEF Status Tracker ?",
    'guide.s1.p1': "ANEF Status Tracker est une <strong class=\"text-text-main\">extension Chrome gratuite</strong> qui surveille l'avancement de votre dossier de naturalisation sur le portail ANEF.",
    'guide.s1.p2': "En plus de vous informer en temps réel sur votre statut, elle contribue anonymement aux <strong class=\"text-text-main\">statistiques communautaires</strong> que vous consultez sur ce site. Plus on est nombreux, plus les chiffres sont fiables !",

    'guide.s2.title': "Comment installer l'extension ?",
    'guide.s2.cws.title': "Chrome Web Store (recommandé)",
    'guide.s2.cws.desc': "Installation en un clic, mises à jour automatiques.",
    'guide.s2.cws.btn': "Installer depuis le Chrome Web Store",
    'guide.s2.manual.summary': "Installation manuelle (avancé) ▸",
    'guide.s2.manual.s1.title': "Téléchargez l'extension",
    'guide.s2.manual.s1.desc': "Rendez-vous sur la <a href=\"https://github.com/Letranger-dev/anef-extension/releases\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">page GitHub du projet</a> et téléchargez la dernière version (fichier ZIP).",
    'guide.s2.manual.s2.title': "Ouvrez les extensions Chrome",
    'guide.s2.manual.s2.desc': "Dans Chrome, tapez <code class=\"bg-bg px-2 py-0.5 rounded text-primary-light text-xs\">chrome://extensions</code> dans la barre d'adresse.",
    'guide.s2.manual.s3.title': "Activez le mode développeur",
    'guide.s2.manual.s3.desc': "En haut à droite de la page, activez le bouton « Mode développeur ».",
    'guide.s2.manual.s4.title': "Chargez l'extension",
    'guide.s2.manual.s4.desc': "Cliquez sur « Charger l'extension non empaquetée » et sélectionnez le dossier décompressé.",

    'guide.s3.title': "Comment utiliser l'extension ?",
    'guide.s3.s1.title': "Ouvrez le popup de l'extension",
    'guide.s3.s1.desc': "Cliquez sur l'icône ANEF Status Tracker dans la barre d'outils Chrome.",
    'guide.s3.s2.title': "Cliquez sur « Actualiser »",
    'guide.s3.s2.desc': "L'extension ouvre le portail ANEF en arrière-plan, récupère votre statut et vous l'affiche en français clair. L'opération peut prendre jusqu'à 45 secondes.",
    'guide.s3.s3.title': "Les statistiques sont envoyées automatiquement",
    'guide.s3.s3.desc': "À chaque actualisation, un résumé anonyme de votre étape est envoyé aux statistiques communautaires. C'est automatique, rien de plus à faire !",

    'guide.s3b.title': "Enregistrer ses identifiants (optionnel)",
    'guide.s3b.intro': "Pour ne pas avoir à vous reconnecter à chaque fois, vous pouvez enregistrer vos identifiants ANEF dans les paramètres de l'extension. L'actualisation se fera alors <strong class=\"text-text-main\">entièrement en arrière-plan</strong>, sans intervention de votre part.",
    'guide.s3b.s1': "Ouvrez le popup et allez dans les <strong class=\"text-text-main\">Paramètres</strong>",
    'guide.s3b.s2': "Entrez votre identifiant et mot de passe ANEF",
    'guide.s3b.s3': "Cliquez sur « Actualiser » : la connexion et la récupération se font automatiquement !",
    'guide.s3b.security': "<strong class=\"text-success\">Sécurité :</strong> Vos identifiants sont chiffrés localement avec AES-256-GCM (chiffrement de niveau bancaire). Ils restent uniquement dans votre navigateur et ne sont jamais envoyés à un serveur externe.",

    'guide.s3c.title': "Conseils pour de meilleures statistiques",
    'guide.s3c.tip1': "<strong class=\"text-text-main\">Actualisez régulièrement</strong> — Plus vous cliquez sur « Actualiser », plus l'historique de votre dossier s'enrichit et plus les statistiques sont précises pour tout le monde.",
    'guide.s3c.tip2': "<strong class=\"text-text-main\">Chaque statut compte</strong> — À chaque changement de statut détecté, une nouvelle entrée est créée dans les statistiques. C'est comme ça qu'on suit la progression des dossiers.",
    'guide.s3c.tip3': "<strong class=\"text-text-main\">Plus on est nombreux, mieux c'est</strong> — N'hésitez pas à partager l'extension avec d'autres personnes en cours de naturalisation !",

    'guide.s4.title': "Protection de vos données",
    'guide.s4.c1.title': "Numéro de dossier chiffré",
    'guide.s4.c1.desc': "Votre numéro est transformé par un algorithme cryptographique (SHA-256). Personne ne peut le retrouver.",
    'guide.s4.c2.title': "Aucune donnée personnelle",
    'guide.s4.c2.desc': "Ni votre nom, ni votre email, ni votre adresse ne sont stockés. Jamais.",
    'guide.s4.c3.title': "Dates tronquées",
    'guide.s4.c3.desc': "Seul le jour est conservé, jamais l'heure exacte, pour qu'aucun recoupement ne soit possible.",
    'guide.s4.c4.title': "Désactivable à tout moment",
    'guide.s4.c4.desc': "Un simple clic dans les paramètres de l'extension et le partage s'arrête. Aucune pression.",
    'guide.s4.opensource': "Code 100% open source — <a href=\"https://github.com/Letranger-dev/anef-extension\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">vérifiez par vous-même sur GitHub</a>"
  });

  /* ---------------------------------------------------------------- EN */
  ANEF.i18n.register('en', {
    'guide.s1.title': "What is ANEF Status Tracker?",
    'guide.s1.p1': "ANEF Status Tracker is a <strong class=\"text-text-main\">free Chrome extension</strong> that monitors the progress of your naturalisation application on the ANEF portal.",
    'guide.s1.p2': "Besides keeping you informed in real time about your status, it anonymously contributes to the <strong class=\"text-text-main\">community statistics</strong> you browse on this site. The more of us there are, the more reliable the figures!",

    'guide.s2.title': "How to install the extension?",
    'guide.s2.cws.title': "Chrome Web Store (recommended)",
    'guide.s2.cws.desc': "One-click install, automatic updates.",
    'guide.s2.cws.btn': "Install from the Chrome Web Store",
    'guide.s2.manual.summary': "Manual installation (advanced) ▸",
    'guide.s2.manual.s1.title': "Download the extension",
    'guide.s2.manual.s1.desc': "Go to the <a href=\"https://github.com/Letranger-dev/anef-extension/releases\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">project's GitHub page</a> and download the latest version (ZIP file).",
    'guide.s2.manual.s2.title': "Open the Chrome extensions page",
    'guide.s2.manual.s2.desc': "In Chrome, type <code class=\"bg-bg px-2 py-0.5 rounded text-primary-light text-xs\">chrome://extensions</code> in the address bar.",
    'guide.s2.manual.s3.title': "Enable developer mode",
    'guide.s2.manual.s3.desc': "In the top right of the page, turn on the “Developer mode” toggle.",
    'guide.s2.manual.s4.title': "Load the extension",
    'guide.s2.manual.s4.desc': "Click “Load unpacked” and select the unzipped folder.",

    'guide.s3.title': "How to use the extension?",
    'guide.s3.s1.title': "Open the extension popup",
    'guide.s3.s1.desc': "Click the ANEF Status Tracker icon in the Chrome toolbar.",
    'guide.s3.s2.title': "Click “Refresh”",
    'guide.s3.s2.desc': "The extension opens the ANEF portal in the background, retrieves your status and displays it in plain language. The operation can take up to 45 seconds.",
    'guide.s3.s3.title': "Statistics are sent automatically",
    'guide.s3.s3.desc': "Each time you refresh, an anonymous summary of your stage is sent to the community statistics. It's automatic, nothing more to do!",

    'guide.s3b.title': "Save your credentials (optional)",
    'guide.s3b.intro': "To avoid logging in again every time, you can save your ANEF credentials in the extension settings. The refresh will then run <strong class=\"text-text-main\">entirely in the background</strong>, with no action from you.",
    'guide.s3b.s1': "Open the popup and go to <strong class=\"text-text-main\">Settings</strong>",
    'guide.s3b.s2': "Enter your ANEF username and password",
    'guide.s3b.s3': "Click “Refresh”: login and retrieval happen automatically!",
    'guide.s3b.security': "<strong class=\"text-success\">Security:</strong> Your credentials are encrypted locally with AES-256-GCM (bank-grade encryption). They stay only in your browser and are never sent to an external server.",

    'guide.s3c.title': "Tips for better statistics",
    'guide.s3c.tip1': "<strong class=\"text-text-main\">Refresh regularly</strong> — The more you click “Refresh”, the richer your application's history becomes and the more accurate the statistics are for everyone.",
    'guide.s3c.tip2': "<strong class=\"text-text-main\">Every status counts</strong> — Each time a status change is detected, a new entry is created in the statistics. That's how application progress is tracked.",
    'guide.s3c.tip3': "<strong class=\"text-text-main\">The more of us, the better</strong> — Feel free to share the extension with other people going through naturalisation!",

    'guide.s4.title': "Protecting your data",
    'guide.s4.c1.title': "Encrypted application number",
    'guide.s4.c1.desc': "Your number is transformed by a cryptographic algorithm (SHA-256). No one can recover it.",
    'guide.s4.c2.title': "No personal data",
    'guide.s4.c2.desc': "Neither your name, nor your email, nor your address is stored. Ever.",
    'guide.s4.c3.title': "Truncated dates",
    'guide.s4.c3.desc': "Only the day is kept, never the exact time, so that no cross-referencing is possible.",
    'guide.s4.c4.title': "Can be turned off anytime",
    'guide.s4.c4.desc': "A single click in the extension settings stops the sharing. No pressure.",
    'guide.s4.opensource': "100% open-source code — <a href=\"https://github.com/Letranger-dev/anef-extension\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">check it yourself on GitHub</a>"
  });

  /* ---------------------------------------------------------------- ES */
  ANEF.i18n.register('es', {
    'guide.s1.title': "¿Qué es ANEF Status Tracker?",
    'guide.s1.p1': "ANEF Status Tracker es una <strong class=\"text-text-main\">extensión de Chrome gratuita</strong> que supervisa el avance de tu expediente de naturalización en el portal ANEF.",
    'guide.s1.p2': "Además de informarte en tiempo real sobre tu estado, contribuye anónimamente a las <strong class=\"text-text-main\">estadísticas comunitarias</strong> que consultas en este sitio. ¡Cuantos más seamos, más fiables son las cifras!",

    'guide.s2.title': "¿Cómo instalar la extensión?",
    'guide.s2.cws.title': "Chrome Web Store (recomendado)",
    'guide.s2.cws.desc': "Instalación con un clic, actualizaciones automáticas.",
    'guide.s2.cws.btn': "Instalar desde la Chrome Web Store",
    'guide.s2.manual.summary': "Instalación manual (avanzado) ▸",
    'guide.s2.manual.s1.title': "Descarga la extensión",
    'guide.s2.manual.s1.desc': "Ve a la <a href=\"https://github.com/Letranger-dev/anef-extension/releases\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">página de GitHub del proyecto</a> y descarga la última versión (archivo ZIP).",
    'guide.s2.manual.s2.title': "Abre las extensiones de Chrome",
    'guide.s2.manual.s2.desc': "En Chrome, escribe <code class=\"bg-bg px-2 py-0.5 rounded text-primary-light text-xs\">chrome://extensions</code> en la barra de direcciones.",
    'guide.s2.manual.s3.title': "Activa el modo de desarrollador",
    'guide.s2.manual.s3.desc': "En la parte superior derecha de la página, activa el botón «Modo de desarrollador».",
    'guide.s2.manual.s4.title': "Carga la extensión",
    'guide.s2.manual.s4.desc': "Haz clic en «Cargar extensión descomprimida» y selecciona la carpeta descomprimida.",

    'guide.s3.title': "¿Cómo usar la extensión?",
    'guide.s3.s1.title': "Abre la ventana emergente de la extensión",
    'guide.s3.s1.desc': "Haz clic en el icono de ANEF Status Tracker en la barra de herramientas de Chrome.",
    'guide.s3.s2.title': "Haz clic en «Actualizar»",
    'guide.s3.s2.desc': "La extensión abre el portal ANEF en segundo plano, recupera tu estado y te lo muestra en lenguaje claro. La operación puede tardar hasta 45 segundos.",
    'guide.s3.s3.title': "Las estadísticas se envían automáticamente",
    'guide.s3.s3.desc': "Cada vez que actualizas, se envía un resumen anónimo de tu etapa a las estadísticas comunitarias. ¡Es automático, nada más que hacer!",

    'guide.s3b.title': "Guardar tus credenciales (opcional)",
    'guide.s3b.intro': "Para no tener que volver a conectarte cada vez, puedes guardar tus credenciales ANEF en los ajustes de la extensión. La actualización se hará entonces <strong class=\"text-text-main\">completamente en segundo plano</strong>, sin intervención por tu parte.",
    'guide.s3b.s1': "Abre la ventana emergente y ve a los <strong class=\"text-text-main\">Ajustes</strong>",
    'guide.s3b.s2': "Introduce tu usuario y contraseña de ANEF",
    'guide.s3b.s3': "Haz clic en «Actualizar»: la conexión y la recuperación se hacen automáticamente.",
    'guide.s3b.security': "<strong class=\"text-success\">Seguridad:</strong> Tus credenciales se cifran localmente con AES-256-GCM (cifrado de nivel bancario). Permanecen únicamente en tu navegador y nunca se envían a un servidor externo.",

    'guide.s3c.title': "Consejos para mejores estadísticas",
    'guide.s3c.tip1': "<strong class=\"text-text-main\">Actualiza con regularidad</strong> — Cuanto más pulses «Actualizar», más se enriquece el historial de tu expediente y más precisas son las estadísticas para todos.",
    'guide.s3c.tip2': "<strong class=\"text-text-main\">Cada estado cuenta</strong> — Cada vez que se detecta un cambio de estado, se crea una nueva entrada en las estadísticas. Así es como se sigue el avance de los expedientes.",
    'guide.s3c.tip3': "<strong class=\"text-text-main\">Cuantos más seamos, mejor</strong> — ¡No dudes en compartir la extensión con otras personas en proceso de naturalización!",

    'guide.s4.title': "Protección de tus datos",
    'guide.s4.c1.title': "Número de expediente cifrado",
    'guide.s4.c1.desc': "Tu número se transforma mediante un algoritmo criptográfico (SHA-256). Nadie puede recuperarlo.",
    'guide.s4.c2.title': "Ningún dato personal",
    'guide.s4.c2.desc': "Ni tu nombre, ni tu correo, ni tu dirección se almacenan. Nunca.",
    'guide.s4.c3.title': "Fechas truncadas",
    'guide.s4.c3.desc': "Solo se conserva el día, nunca la hora exacta, para que no sea posible ningún cruce de datos.",
    'guide.s4.c4.title': "Desactivable en cualquier momento",
    'guide.s4.c4.desc': "Un simple clic en los ajustes de la extensión y el uso compartido se detiene. Sin presión.",
    'guide.s4.opensource': "Código 100% de código abierto — <a href=\"https://github.com/Letranger-dev/anef-extension\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">compruébalo tú mismo en GitHub</a>"
  });

  /* ---------------------------------------------------------------- AR */
  ANEF.i18n.register('ar', {
    'guide.s1.title': "ما هو ANEF Status Tracker؟",
    'guide.s1.p1': "ANEF Status Tracker هو <strong class=\"text-text-main\">إضافة مجانية لمتصفّح Chrome</strong> تراقب تقدّم ملف التجنّس الخاص بك على بوّابة ANEF.",
    'guide.s1.p2': "بالإضافة إلى إبلاغك بحالتك في الوقت الفعلي، تساهم بشكل مجهول في <strong class=\"text-text-main\">الإحصائيات المجتمعية</strong> التي تطّلع عليها على هذا الموقع. كلّما زاد عددنا، زادت موثوقية الأرقام!",

    'guide.s2.title': "كيف تركّب الإضافة؟",
    'guide.s2.cws.title': "Chrome Web Store (موصى به)",
    'guide.s2.cws.desc': "تثبيت بنقرة واحدة، تحديثات تلقائية.",
    'guide.s2.cws.btn': "التثبيت من Chrome Web Store",
    'guide.s2.manual.summary': "التثبيت اليدوي (متقدّم) ▸",
    'guide.s2.manual.s1.title': "نزّل الإضافة",
    'guide.s2.manual.s1.desc': "انتقل إلى <a href=\"https://github.com/Letranger-dev/anef-extension/releases\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">صفحة GitHub للمشروع</a> ونزّل أحدث إصدار (ملف ZIP).",
    'guide.s2.manual.s2.title': "افتح إضافات Chrome",
    'guide.s2.manual.s2.desc': "في Chrome، اكتب <code class=\"bg-bg px-2 py-0.5 rounded text-primary-light text-xs\">chrome://extensions</code> في شريط العنوان.",
    'guide.s2.manual.s3.title': "فعّل وضع المطوّر",
    'guide.s2.manual.s3.desc': "في أعلى يمين الصفحة، فعّل زر «وضع المطوّر».",
    'guide.s2.manual.s4.title': "حمّل الإضافة",
    'guide.s2.manual.s4.desc': "انقر على «تحميل إضافة غير مضغوطة» واختر المجلّد بعد فكّ ضغطه.",

    'guide.s3.title': "كيف تستخدم الإضافة؟",
    'guide.s3.s1.title': "افتح النافذة المنبثقة للإضافة",
    'guide.s3.s1.desc': "انقر على أيقونة ANEF Status Tracker في شريط أدوات Chrome.",
    'guide.s3.s2.title': "انقر على «تحديث»",
    'guide.s3.s2.desc': "تفتح الإضافة بوّابة ANEF في الخلفية، وتسترد حالتك وتعرضها عليك بلغة واضحة. قد تستغرق العملية حتى 45 ثانية.",
    'guide.s3.s3.title': "تُرسل الإحصائيات تلقائيًا",
    'guide.s3.s3.desc': "في كل تحديث، يُرسل ملخّص مجهول عن مرحلتك إلى الإحصائيات المجتمعية. إنّه تلقائي، لا شيء آخر عليك فعله!",

    'guide.s3b.title': "حفظ بيانات اعتمادك (اختياري)",
    'guide.s3b.intro': "حتى لا تضطر إلى تسجيل الدخول في كل مرّة، يمكنك حفظ بيانات اعتماد ANEF في إعدادات الإضافة. عندئذ يتم التحديث <strong class=\"text-text-main\">بالكامل في الخلفية</strong>، دون أي تدخّل منك.",
    'guide.s3b.s1': "افتح النافذة المنبثقة وانتقل إلى <strong class=\"text-text-main\">الإعدادات</strong>",
    'guide.s3b.s2': "أدخل اسم المستخدم وكلمة المرور الخاصين بـ ANEF",
    'guide.s3b.s3': "انقر على «تحديث»: يتم الاتصال واسترداد البيانات تلقائيًا!",
    'guide.s3b.security': "<strong class=\"text-success\">الأمان:</strong> تُشفّر بيانات اعتمادك محليًا بـ AES-256-GCM (تشفير بمستوى بنكي). تبقى فقط في متصفّحك ولا تُرسل أبدًا إلى خادم خارجي.",

    'guide.s3c.title': "نصائح لإحصائيات أفضل",
    'guide.s3c.tip1': "<strong class=\"text-text-main\">حدّث بانتظام</strong> — كلّما نقرت على «تحديث»، ازداد سجل ملفك ثراءً وازدادت دقّة الإحصائيات للجميع.",
    'guide.s3c.tip2': "<strong class=\"text-text-main\">كل حالة مهمّة</strong> — في كل مرّة يُكتشف فيها تغيّر في الحالة، يُنشأ إدخال جديد في الإحصائيات. هكذا يُتابع تقدّم الملفات.",
    'guide.s3c.tip3': "<strong class=\"text-text-main\">كلّما زاد عددنا، كان أفضل</strong> — لا تتردّد في مشاركة الإضافة مع أشخاص آخرين في طور التجنّس!",

    'guide.s4.title': "حماية بياناتك",
    'guide.s4.c1.title': "رقم الملف مُشفّر",
    'guide.s4.c1.desc': "يُحوّل رقمك بواسطة خوارزمية تشفير (SHA-256). لا يمكن لأحد استعادته.",
    'guide.s4.c2.title': "لا بيانات شخصية",
    'guide.s4.c2.desc': "لا اسمك، ولا بريدك الإلكتروني، ولا عنوانك يُخزّن. أبدًا.",
    'guide.s4.c3.title': "تواريخ مقتطعة",
    'guide.s4.c3.desc': "يُحتفظ باليوم فقط، وليس بالوقت الدقيق أبدًا، حتى لا يكون أي ربط ممكنًا.",
    'guide.s4.c4.title': "قابل للتعطيل في أي وقت",
    'guide.s4.c4.desc': "نقرة واحدة في إعدادات الإضافة وتتوقّف المشاركة. دون أي ضغط.",
    'guide.s4.opensource': "شفرة مفتوحة المصدر 100% — <a href=\"https://github.com/Letranger-dev/anef-extension\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">تحقّق بنفسك على GitHub</a>"
  });

  /* ---------------------------------------------------------------- ZH */
  ANEF.i18n.register('zh', {
    'guide.s1.title': "ANEF Status Tracker 是什么？",
    'guide.s1.p1': "ANEF Status Tracker 是一款<strong class=\"text-text-main\">免费的 Chrome 扩展</strong>，用于在 ANEF 门户上监控您入籍申请的进展。",
    'guide.s1.p2': "除了实时告知您的状态外，它还匿名地为您在本站查阅的<strong class=\"text-text-main\">社区统计</strong>做出贡献。参与的人越多，数据就越可靠！",

    'guide.s2.title': "如何安装扩展？",
    'guide.s2.cws.title': "Chrome Web Store（推荐）",
    'guide.s2.cws.desc': "一键安装，自动更新。",
    'guide.s2.cws.btn': "从 Chrome Web Store 安装",
    'guide.s2.manual.summary': "手动安装（高级）▸",
    'guide.s2.manual.s1.title': "下载扩展",
    'guide.s2.manual.s1.desc': "前往<a href=\"https://github.com/Letranger-dev/anef-extension/releases\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">项目的 GitHub 页面</a>，下载最新版本（ZIP 文件）。",
    'guide.s2.manual.s2.title': "打开 Chrome 扩展页面",
    'guide.s2.manual.s2.desc': "在 Chrome 中，于地址栏输入 <code class=\"bg-bg px-2 py-0.5 rounded text-primary-light text-xs\">chrome://extensions</code>。",
    'guide.s2.manual.s3.title': "启用开发者模式",
    'guide.s2.manual.s3.desc': "在页面右上角，打开“开发者模式”开关。",
    'guide.s2.manual.s4.title': "加载扩展",
    'guide.s2.manual.s4.desc': "点击“加载已解压的扩展程序”，选择解压后的文件夹。",

    'guide.s3.title': "如何使用扩展？",
    'guide.s3.s1.title': "打开扩展的弹窗",
    'guide.s3.s1.desc': "点击 Chrome 工具栏中的 ANEF Status Tracker 图标。",
    'guide.s3.s2.title': "点击“刷新”",
    'guide.s3.s2.desc': "扩展会在后台打开 ANEF 门户，获取您的状态并以通俗易懂的语言显示。该操作最多需要 45 秒。",
    'guide.s3.s3.title': "统计数据自动发送",
    'guide.s3.s3.desc': "每次刷新时，都会将您所处阶段的匿名摘要发送到社区统计。这是自动完成的，无需额外操作！",

    'guide.s3b.title': "保存您的凭证（可选）",
    'guide.s3b.intro': "为避免每次重新登录，您可以在扩展设置中保存您的 ANEF 凭证。这样刷新将<strong class=\"text-text-main\">完全在后台进行</strong>，无需您的任何操作。",
    'guide.s3b.s1': "打开弹窗并进入<strong class=\"text-text-main\">设置</strong>",
    'guide.s3b.s2': "输入您的 ANEF 用户名和密码",
    'guide.s3b.s3': "点击“刷新”：登录和获取将自动完成！",
    'guide.s3b.security': "<strong class=\"text-success\">安全：</strong>您的凭证使用 AES-256-GCM（银行级加密）在本地加密。它们仅保留在您的浏览器中，绝不会发送到外部服务器。",

    'guide.s3c.title': "获得更佳统计的建议",
    'guide.s3c.tip1': "<strong class=\"text-text-main\">定期刷新</strong> — 您点击“刷新”越多，您案卷的历史记录就越丰富，对所有人来说统计也就越准确。",
    'guide.s3c.tip2': "<strong class=\"text-text-main\">每个状态都很重要</strong> — 每当检测到状态变化时，统计中都会创建一条新记录。这就是跟踪案卷进展的方式。",
    'guide.s3c.tip3': "<strong class=\"text-text-main\">参与的人越多越好</strong> — 欢迎将该扩展分享给其他正在办理入籍的人！",

    'guide.s4.title': "保护您的数据",
    'guide.s4.c1.title': "加密的案卷号",
    'guide.s4.c1.desc': "您的号码经过加密算法（SHA-256）转换。任何人都无法还原它。",
    'guide.s4.c2.title': "无任何个人数据",
    'guide.s4.c2.desc': "您的姓名、邮箱和地址都不会被存储。从不。",
    'guide.s4.c3.title': "截断的日期",
    'guide.s4.c3.desc': "仅保留日期，绝不保留具体时间，以确保无法进行任何数据交叉比对。",
    'guide.s4.c4.title': "随时可禁用",
    'guide.s4.c4.desc': "在扩展设置中只需点击一下，共享即停止。毫无压力。",
    'guide.s4.opensource': "100% 开源代码 — <a href=\"https://github.com/Letranger-dev/anef-extension\" target=\"_blank\" rel=\"noopener\" class=\"text-primary-light hover:underline\">在 GitHub 上自行验证</a>"
  });
})();
