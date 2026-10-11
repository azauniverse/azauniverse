(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const storageKey = "aza-universe-v2";
  const state = loadState();
  let lang = localStorage.getItem("aza-lang") || "ky";
  let toastTimer = null, reactionTimer = null, reactionStart = 0, reactionState = "idle";
  let quizIndex = 0, quizScore = 0, quizAnswered = false, currentQuiz = "general";
  let supabaseClient = null, cloudUser = null, cloudProfile = null, authMode = "signin", authBusy = false;
  const supabaseConfig = window.AZA_SUPABASE_CONFIG || {};

  const copy = {
    ky: {
      tagline:"ТЕСТТЕР • ОЮНДАР • AI • СООБЩЕСТВО",navHome:"Башкы бет",navGames:"Оюндар",navTests:"Тесттер",navAI:"AI куралдар",navRanking:"Рейтинг",navChallenges:"Чакырыктар",login:"Кирүү",
      heroEyebrow:"ЖАҢЫ ДҮЙНӨГӨ КОШ КЕЛДИҢ",heroName1:"AZA",heroName2:"UNIVERSE",heroSubtitle:"ТЕСТТЕР • ОЮНДАР • AI КУРАЛДАР • СООБЩЕСТВО",heroText:"Кызыктуу контент, оюндар, AI куралдары жана достор менен бирге жаңы дүйнө!",startNow:"АЗЫР БАШТА",watchMore:"Көбүрөөк көрүү",freeAccess:"Акысыз кирүү",freshContent:"Жаңы контент",
      railTests:"КЫЗЫК ТЕСТТЕР",railGames:"МИНИ-ОЮНДАР",railAI:"AI КУРАЛДАРЫ",railRating:"УПАЙ РЕЙТИНГИ",railDaily:"КҮНҮМДҮК ЧАКЫРЫК",featuresEyebrow:"АЗА ААЛАМЫНА КИР",featuresTitle:"Бир дүйнө. Көп мүмкүнчүлүк.",featuresText:"Өзүңө жаккан багытты танда — анан деңгээлиңди көтөр.",
      testsKicker:"БИЛИМИҢДИ СЫНАГЫН",testsTitle:"Кызыктуу тесттер",testsText:"Мүнөзүңдү, логикаңды жана билимиңди сынап көр.",exploreTests:"Тесттерди көрүү",gamesKicker:"РЕКОРДУҢДУ ЖАҢЫЛА",gamesTitle:"Мини-оюндар",gamesText:"Ойно, рекорд кой, досторуң менен жарыш.",playNow:"Азыр ойно",aiKicker:"КРЕАТИВДҮҮ КУРАЛДАР",aiTitle:"AI куралдары",aiText:"Пост, никнейм жана видео идеяларын түз.",openTools:"Куралдарды ач",rankingKicker:"ӨЗҮҢДҮ КӨРСӨТ",rankingTitle:"Рейтинг",rankingText:"Упай топто, өз рекордуңду жакшырт.",viewRanking:"Рейтингди көрүү",challengeKicker:"КҮН САЙЫН ЖАҢЫ",challengeTitle:"Чакырыктар",challengeText:"Күн сайын жаңы тапшырмага аракет кыл.",startChallenge:"Чакырыкты баштоо",communityKicker:"ДОСТОР МЕНЕН",communityTitle:"Сообщество",communityText:"Сайтты бөлүшүп, досторуңду чакыр.",inviteFriends:"Досторду чакыр",
      dailyEyebrow:"БҮГҮНКҮ ЧАКЫРЫК",dailyTitle:"ЛОГИКАЛЫК ТЕСТ",dailyText:"5 суроого жооп бер жана упай топто!",fiveQuestions:"5 суроо",fewMinutes:"2–3 мүнөт",beginChallenge:"Чакырыкты баштоо",pointsLabel:"УПАЙ",popularEyebrow:"ӨЗҮҢДҮ СЫНАП КӨР",popularTitle:"Популярдуу тесттер",seeAll:"Баарын көрүү →",popularPersonality:"Кызыктуу тест",quickQuiz:"5 суроо",popularAnime:"Аниме тест",popularCars:"Авто тест",popularIQ:"IQ тест",topPlayersEyebrow:"ДЕМО-РЕЙТИНГ",topPlayers:"Топ оюнчулар",rankingDemoNote:"Бул макеттеги мисал рейтинг. Чыныгы онлайн рейтинг сервер кошулганда иштейт.",yourPoints:"Сенин упайың",thisDevice:"Бул түзмөк",onlineAccount:"Онлайн аккаунт",onlineRankingLabel:"ОНЛАЙН РЕЙТИНГ",onlineRankingNote:"Рейтинг Supabase базасынан жаңыланат.",noOnlinePlayers:"Азырынча рейтингде оюнчулар жок. Биринчи болуп каттал!",rankingLoadError:"Рейтингти жүктөө мүмкүн болгон жок. SQL схемасын жана ачкычтарды текшер.",authNotConfiguredTitle:"Аккаунт системасын туташтыруу керек",authNotConfiguredText:"Supabase долбоорун түзүп, Project URL жана Publishable key коюлгандан кийин аккаунттар иштейт.",authUnavailable:"Supabase китепканасы жүктөлгөн жок. Интернетти текшерип, баракты кайра ач.",authSignIn:"Аккаунтка кирүү",authSignUp:"Катталуу",authEmail:"Электрондук почта",authPassword:"Сырсөз",authUsername:"Колдонуучу аты",authSubmitSignIn:"Кирүү",authSubmitSignUp:"Аккаунт түзүү",authSwitchToSignUp:"Аккаунтуң жокпу? Каттал",authSwitchToSignIn:"Аккаунтуң барбы? Кирүү",authSigningIn:"Кирип жатат…",authSigningUp:"Катталуу…",authCheckEmail:"Катталуу дээрлик бүттү! Электрондук почтаңа келген ырастоо шилтемесин бас.",authGenericError:"Кирүү ишке ашкан жок. Маалыматты текшерип кайра аракет кыл.",authBadUsername:"Колдонуучу аты 3–20 белгиден турушу керек.",authBadPassword:"Сырсөз кеминде 8 белгиден турушу керек.",authSignedIn:"Аккаунтка ийгиликтүү кирдиң!",authSignedOut:"Аккаунттан чыктың.",authLogout:"Чыгуу",authOnlinePoints:"Онлайн упайлар",authBestReaction:"Мыкты реакция",authHelp:"Сырсөзүңдү башка адамдар менен бөлүшпө.",
      metricTests:"Тесттер",metricTestsSmall:"Билимиңди сына",metricGames:"Мини-оюндар",metricGamesSmall:"Рекорд кой",metricAI:"AI куралдары",metricAISmall:"Идея түз",metricDaily:"Күнүмдүк чакырык",metricDailySmall:"Күн сайын аракет",metricCommunity:"Сообщество",metricCommunitySmall:"Бөлүш жана чакыр",shareEyebrow:"ДОСТОРУҢДУ ЧАКЫР",shareTitle:"Кимдин деңгээли жогору?",shareText:"AZA UNIVERSE'ти бөлүшүп, досторуң менен сынаш.",shareBtn:"Бөлүшүү",footerDescription:"Кызыктуу дүйнө, жаңы мүмкүнчүлүктөр жана оюндар — бир жерде.",footerNav:"Навигация",footerCommunity:"Коомчулук",footerKeepGoing:"Деңгээлиңди көтөр!",footerText:"Кызык дүйнөңө кош келдиң."
    },
    ru: {
      tagline:"ТЕСТЫ • ИГРЫ • AI • СООБЩЕСТВО",navHome:"Главная",navGames:"Игры",navTests:"Тесты",navAI:"AI-инструменты",navRanking:"Рейтинг",navChallenges:"Челленджи",login:"Войти",
      heroEyebrow:"ДОБРО ПОЖАЛОВАТЬ В НОВЫЙ МИР",heroName1:"AZA",heroName2:"UNIVERSE",heroSubtitle:"ТЕСТЫ • ИГРЫ • AI-ИНСТРУМЕНТЫ • СООБЩЕСТВО",heroText:"Интересный контент, игры, AI-инструменты и новый мир вместе с друзьями!",startNow:"НАЧАТЬ СЕЙЧАС",watchMore:"Узнать больше",freeAccess:"Бесплатный доступ",freshContent:"Новый контент",
      railTests:"ИНТЕРЕСНЫЕ ТЕСТЫ",railGames:"МИНИ-ИГРЫ",railAI:"AI-ИНСТРУМЕНТЫ",railRating:"РЕЙТИНГ ОЧКОВ",railDaily:"ЕЖЕДНЕВНЫЙ ВЫЗОВ",featuresEyebrow:"ВОЙДИ В МИР AZA",featuresTitle:"Один мир. Много возможностей.",featuresText:"Выбери направление по душе и прокачай свой уровень.",
      testsKicker:"ПРОВЕРЬ СЕБЯ",testsTitle:"Интересные тесты",testsText:"Проверь характер, логику и знания.",exploreTests:"Смотреть тесты",gamesKicker:"ОБНОВИ РЕКОРД",gamesTitle:"Мини-игры",gamesText:"Играй, ставь рекорды и соревнуйся с друзьями.",playNow:"Играть",aiKicker:"КРЕАТИВНЫЕ ИНСТРУМЕНТЫ",aiTitle:"AI-инструменты",aiText:"Создавай идеи постов, никнеймы и видео-сценарии.",openTools:"Открыть инструменты",rankingKicker:"ПОКАЖИ СЕБЯ",rankingTitle:"Рейтинг",rankingText:"Зарабатывай очки и улучшай личный рекорд.",viewRanking:"Смотреть рейтинг",challengeKicker:"КАЖДЫЙ ДЕНЬ НОВОЕ",challengeTitle:"Челленджи",challengeText:"Попробуй выполнить новое задание сегодня.",startChallenge:"Начать челлендж",communityKicker:"ВМЕСТЕ С ДРУЗЬЯМИ",communityTitle:"Сообщество",communityText:"Поделись сайтом и пригласи друзей.",inviteFriends:"Пригласить друзей",
      dailyEyebrow:"ЧЕЛЛЕНДЖ ДНЯ",dailyTitle:"ЛОГИЧЕСКИЙ ТЕСТ",dailyText:"Ответь на 5 вопросов и набери очки!",fiveQuestions:"5 вопросов",fewMinutes:"2–3 минуты",beginChallenge:"Начать челлендж",pointsLabel:"ОЧКОВ",popularEyebrow:"ПРОВЕРЬ СЕБЯ",popularTitle:"Популярные тесты",seeAll:"Смотреть все →",popularPersonality:"Интересный тест",quickQuiz:"5 вопросов",popularAnime:"Аниме-тест",popularCars:"Авто-тест",popularIQ:"IQ-тест",topPlayersEyebrow:"ДЕМО-РЕЙТИНГ",topPlayers:"Топ игроков",rankingDemoNote:"Пример рейтинга для макета. Настоящий онлайн-рейтинг заработает после подключения сервера.",yourPoints:"Твои очки",thisDevice:"Это устройство",onlineAccount:"Онлайн-аккаунт",onlineRankingLabel:"ОНЛАЙН-РЕЙТИНГ",onlineRankingNote:"Рейтинг загружается из базы Supabase.",noOnlinePlayers:"В рейтинге пока нет игроков. Зарегистрируйся первым!",rankingLoadError:"Не удалось загрузить рейтинг. Проверь SQL-схему и ключи.",authNotConfiguredTitle:"Нужно подключить систему аккаунтов",authNotConfiguredText:"Создай проект Supabase и добавь Project URL и Publishable key, чтобы включить аккаунты.",authUnavailable:"Библиотека Supabase не загрузилась. Проверь интернет и обнови страницу.",authSignIn:"Вход в аккаунт",authSignUp:"Регистрация",authEmail:"Электронная почта",authPassword:"Пароль",authUsername:"Имя пользователя",authSubmitSignIn:"Войти",authSubmitSignUp:"Создать аккаунт",authSwitchToSignUp:"Нет аккаунта? Зарегистрироваться",authSwitchToSignIn:"Уже есть аккаунт? Войти",authSigningIn:"Входим…",authSigningUp:"Регистрируем…",authCheckEmail:"Почти готово! Нажми ссылку подтверждения в письме.",authGenericError:"Не удалось войти. Проверь данные и попробуй снова.",authBadUsername:"Имя пользователя должно содержать 3–20 символов.",authBadPassword:"Пароль должен содержать не менее 8 символов.",authSignedIn:"Ты успешно вошёл в аккаунт!",authSignedOut:"Ты вышел из аккаунта.",authLogout:"Выйти",authOnlinePoints:"Онлайн-очки",authBestReaction:"Лучшая реакция",authHelp:"Не передавай пароль другим людям.",
      metricTests:"Тесты",metricTestsSmall:"Проверь знания",metricGames:"Мини-игры",metricGamesSmall:"Поставь рекорд",metricAI:"AI-инструменты",metricAISmall:"Создай идею",metricDaily:"Ежедневный вызов",metricDailySmall:"Пробуй каждый день",metricCommunity:"Сообщество",metricCommunitySmall:"Делись и приглашай",shareEyebrow:"ПРИГЛАСИ ДРУЗЕЙ",shareTitle:"У кого уровень выше?",shareText:"Поделись AZA UNIVERSE и соревнуйся с друзьями.",shareBtn:"Поделиться",footerDescription:"Интересный мир, новые возможности и игры — в одном месте.",footerNav:"Навигация",footerCommunity:"Сообщество",footerKeepGoing:"Прокачивай свой уровень!",footerText:"Добро пожаловать в свой мир."
    }
  };

  const quizSets = {
    general: {
      ky:[
        {q:"Кыргызстандын борбору кайсы шаар?",a:["Ош","Бишкек","Талас","Нарын"],correct:1,why:"Бишкек — Кыргызстандын борбору."},
        {q:"Бир саатта канча мүнөт бар?",a:["30","50","60","100"],correct:2,why:"Бир саат 60 мүнөттөн турат."},
        {q:"Күн системасындагы эң чоң планета кайсы?",a:["Марс","Жер","Сатурн","Юпитер"],correct:3,why:"Юпитер — Күн системасындагы эң чоң планета."},
        {q:"HTML негизинен эмне үчүн колдонулат?",a:["Веб-барактын түзүлүшү","Сүрөт тартуу гана","Маалымат базасын сактоо","Интернеттин ылдамдыгын көбөйтүү"],correct:0,why:"HTML веб-барактын мазмунун жана түзүлүшүн белгилейт."},
        {q:"9 × 7 канча болот?",a:["56","63","72","67"],correct:1,why:"9 × 7 = 63."}
      ],
      ru:[
        {q:"Какой город является столицей Кыргызстана?",a:["Ош","Бишкек","Талас","Нарын"],correct:1,why:"Бишкек — столица Кыргызстана."},
        {q:"Сколько минут в одном часе?",a:["30","50","60","100"],correct:2,why:"В одном часе 60 минут."},
        {q:"Какая планета самая большая в Солнечной системе?",a:["Марс","Земля","Сатурн","Юпитер"],correct:3,why:"Юпитер — самая большая планета Солнечной системы."},
        {q:"Для чего в основном используется HTML?",a:["Для структуры веб-страницы","Только для рисования","Для хранения базы данных","Для ускорения интернета"],correct:0,why:"HTML описывает структуру и содержимое веб-страницы."},
        {q:"Сколько будет 9 × 7?",a:["56","63","72","67"],correct:1,why:"9 × 7 = 63."}
      ]
    },
    iq: {
      ky:[
        {q:"Кийинки сан кайсы? 2, 4, 8, 16, …",a:["18","24","30","32"],correct:3,why:"Ар бир сан 2ге көбөйтүлөт."},
        {q:"Үч мышык үч чычканды 3 мүнөттө кармаса, бир мышык бир чычканды канча мүнөттө кармайт?",a:["1","3","6","9"],correct:1,why:"Ар бир мышык бир чычканды 3 мүнөттө кармайт."},
        {q:"Кайсысы башкаларынан айырмаланат?",a:["Үч бурчтук","Төрт бурчтук","Тегерек","Беш бурчтук"],correct:2,why:"Тегеректин түз капталдары жана бурчтары жок."},
        {q:"Эгер бүгүн шаршемби болсо, 10 күндөн кийин кайсы күн?",a:["Жума","Ишемби","Жекшемби","Дүйшөмбү"],correct:1,why:"7 күндөн кийин шаршемби, дагы 3 күндөн кийин ишемби."},
        {q:"5 жумушчу 5 буюмду 5 мүнөттө жасайт. 1 жумушчу 1 буюмду канча мүнөттө жасайт?",a:["1","5","10","25"],correct:1,why:"Ар бир жумушчу бир буюмду 5 мүнөттө жасайт."}
      ],
      ru:[
        {q:"Какое число следующее? 2, 4, 8, 16, …",a:["18","24","30","32"],correct:3,why:"Каждое число умножается на 2."},
        {q:"Три кошки ловят трёх мышей за 3 минуты. За сколько минут одна кошка поймает одну мышь?",a:["1","3","6","9"],correct:1,why:"Каждая кошка ловит одну мышь за 3 минуты."},
        {q:"Что отличается от остальных?",a:["Треугольник","Четырёхугольник","Круг","Пятиугольник"],correct:2,why:"У круга нет прямых сторон и углов."},
        {q:"Если сегодня среда, какой день будет через 10 дней?",a:["Пятница","Суббота","Воскресенье","Понедельник"],correct:1,why:"Через 7 дней снова среда, ещё через 3 дня — суббота."},
        {q:"Пять рабочих делают пять предметов за пять минут. За сколько минут один рабочий сделает один предмет?",a:["1","5","10","25"],correct:1,why:"Каждому рабочему нужно 5 минут на один предмет."}
      ]
    },
    anime: {
      ky:[
        {q:"«Наруто» анимесиндеги башкы каарман ким?",a:["Ичиго","Наруто","Луффи","Гоку"],correct:1,why:"Башкы каарман — Наруто Узумаки."},
        {q:"«One Piece» анимесиндеги Луффинин кыялы эмне?",a:["Хокаге болуу","Падыша болуу","Пираттардын падышасы болуу","Чемпион болуу"],correct:2,why:"Луффи Пираттардын падышасы болууну кыялданат."},
        {q:"Пикачу кайсы серияга таандык?",a:["Pokémon","Naruto","Bleach","Demon Slayer"],correct:0,why:"Пикачу — Pokémon дүйнөсүнүн белгилүү каарманы."},
        {q:"«Demon Slayer» башкы каарманы ким?",a:["Танджиро","Саске","Зоро","Леви"],correct:0,why:"Танджиро Камадо — башкы каарман."},
        {q:"Гоку кайсы анимеде бар?",a:["One Piece","Dragon Ball","Death Note","Jujutsu Kaisen"],correct:1,why:"Гоку — Dragon Ball сериясынын каарманы."}
      ],
      ru:[
        {q:"Как зовут главного героя аниме «Наруто»?",a:["Ичиго","Наруто","Луффи","Гоку"],correct:1,why:"Главный герой — Наруто Узумаки."},
        {q:"Какая мечта у Луффи из «One Piece»?",a:["Стать Хокаге","Стать королём","Стать Королём пиратов","Стать чемпионом"],correct:2,why:"Луффи хочет стать Королём пиратов."},
        {q:"К какой серии относится Пикачу?",a:["Pokémon","Naruto","Bleach","Demon Slayer"],correct:0,why:"Пикачу — известный персонаж мира Pokémon."},
        {q:"Как зовут главного героя «Клинка, рассекающего демонов»?",a:["Танджиро","Саске","Зоро","Леви"],correct:0,why:"Танджиро Камадо — главный герой серии."},
        {q:"В каком аниме появляется Гоку?",a:["One Piece","Dragon Ball","Death Note","Jujutsu Kaisen"],correct:1,why:"Гоку — герой серии Dragon Ball."}
      ]
    },
    cars: {
      ky:[
        {q:"Ferrari кайсы өлкөдөн чыккан бренд?",a:["Италия","Германия","Япония","АКШ"],correct:0,why:"Ferrari — Италиянын спорттук автоунаа бренди."},
        {q:"Электр унааларын чыгарганы менен белгилүү бренд кайсы?",a:["Tesla","Lamborghini","Bentley","Suzuki"],correct:0,why:"Tesla электромобилдери менен белгилүү."},
        {q:"BMW бренди кайсы өлкөдөн?",a:["Франция","Германия","Түштүк Корея","Канада"],correct:1,why:"BMW — Германиянын автоунаа өндүрүүчүсү."},
        {q:"Унаадагы ABS системасынын негизги милдети эмне?",a:["Музыканы күчөтүү","Дөңгөлөктүн кулпуланышын азайтуу","Күйүүчү май куюу","Жарыкты күйгүзүү"],correct:1,why:"ABS катуу тормоздоодо дөңгөлөктүн кулпуланышын азайтууга жардам берет."},
        {q:"«GT-R» модели кайсы брендге таандык?",a:["Nissan","Toyota","Audi","Volvo"],correct:0,why:"Nissan GT-R — Nissan брендинин модели."}
      ],
      ru:[
        {q:"Из какой страны родом бренд Ferrari?",a:["Италия","Германия","Япония","США"],correct:0,why:"Ferrari — итальянский производитель спортивных автомобилей."},
        {q:"Какой бренд известен своими электромобилями?",a:["Tesla","Lamborghini","Bentley","Suzuki"],correct:0,why:"Tesla известна электромобилями."},
        {q:"Из какой страны бренд BMW?",a:["Франция","Германия","Южная Корея","Канада"],correct:1,why:"BMW — немецкий производитель автомобилей."},
        {q:"Какова основная задача системы ABS?",a:["Усилить музыку","Снизить риск блокировки колёс","Заправить топливо","Включить свет"],correct:1,why:"ABS помогает уменьшить блокировку колёс при резком торможении."},
        {q:"Какому бренду принадлежит модель GT-R?",a:["Nissan","Toyota","Audi","Volvo"],correct:0,why:"Nissan GT-R — модель марки Nissan."}
      ]
    }
  };

  function loadState(){
    try{const p=JSON.parse(localStorage.getItem(storageKey)||"{}");return{points:Number(p.points)||0,bestReaction:Number(p.bestReaction)||0,dailyDate:p.dailyDate||"",dailyDone:!!p.dailyDone};}
    catch{return{points:0,bestReaction:0,dailyDate:"",dailyDone:false};}
  }
  function saveState(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}renderStats();}
  function t(key){return copy[lang][key]||copy.ky[key]||key;}
  function applyLanguage(){
    document.documentElement.lang=lang;
    $$('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(copy[lang][key]!==undefined)el.textContent=copy[lang][key];});
    const langButton=$("#langToggle");if(langButton)langButton.textContent=lang==="ky"?"РУС":"КЫР";
    $$('[data-close]').forEach(el=>{if(el.getAttribute('aria-label'))el.setAttribute('aria-label',lang==="ky"?"Жабуу":"Закрыть");});
    document.title=lang==="ky"?"AZA UNIVERSE — Тесттер • Оюндар • AI":"AZA UNIVERSE — Тесты • Игры • AI";
    renderStats();
  }
  function renderStats(){
    const points=$("#pointsTotal");if(points)points.textContent=Number(cloudProfile ? cloudProfile.total_points : state.points).toLocaleString(lang==="ky"?"ky-KG":"ru-RU");
    const reaction=$("#bestReaction");if(reaction)reaction.textContent=(cloudProfile&&cloudProfile.best_reaction_ms)||state.bestReaction||"—";
    const progress=$("#dailyProgress");if(progress)progress.style.width=state.dailyDone?"100%":"0%";
    const progressText=$("#dailyProgressText");if(progressText)progressText.textContent=state.dailyDone?"5/5":"0/5";
    const badge=$("#pointsModeBadge");if(badge)badge.textContent=cloudUser?t("onlineAccount"):t("thisDevice");
    updateAccountHeader();
  }
  function showToast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2300);}
  function openModal(content){$("#modalContent").innerHTML=content;$("#modal").classList.add("show");$("#modal").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";const first=$("#modalContent input");if(first)setTimeout(()=>first.focus(),50);}
  function closeModal(){const modal=$("#modal");modal.classList.remove("show");modal.setAttribute("aria-hidden","true");document.body.style.overflow="";clearTimeout(reactionTimer);reactionState="idle";}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function localDateKey(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}

  function startQuiz(type="general") {currentQuiz=quizSets[type]?type:"general";quizIndex=0;quizScore=0;quizAnswered=false;renderQuestion();}
  function renderQuestion(){
    const qs=quizSets[currentQuiz][lang],q=qs[quizIndex];
    if(!q){
      const quizAward=quizScore*10;state.points+=quizAward;const today=localDateKey();if(quizScore===5&&state.dailyDate!==today){state.dailyDate=today;state.dailyDone=true;}saveState();if(quizAward>0)void awardCloudPoints("quiz",quizAward);
      const heading=lang==="ky"?"ТЕСТ БҮТТҮ":"ТЕСТ ЗАВЕРШЁН";
      openModal(`<span class="eyebrow">${heading}</span><h2 id="modalTitle">${lang==="ky"?"Сонун иш! 🔥":"Отличная работа! 🔥"}</h2><p>${lang==="ky"?"Сенин жыйынтыгың":"Твой результат"}</p><div class="result-box"><strong>${quizScore}/5</strong><p>${lang==="ky"?"Топтогон упайың":"Набрано очков"}: ${quizScore*10}</p></div><p>${quizScore===5?(lang==="ky"?"Мыкты! Күнүмдүк чакырык аткарылды.":"Отлично! Ежедневный челлендж выполнен."):(lang==="ky"?"Кайра аракет кылып, рекордуңду жакшырт.":"Попробуй ещё раз и улучши результат.")}</p><button class="btn btn-primary full" id="quizAgain">${lang==="ky"?"Кайра өтүү":"Пройти ещё раз"}</button>`);return;
    }
    const titleMap={general:lang==="ky"?"ЖАЛПЫ БИЛИМ ТЕСТИ":"ТЕСТ ОБЩИХ ЗНАНИЙ",iq:"IQ / ЛОГИКА",anime:lang==="ky"?"АНИМЕ ТЕСТ":"АНИМЕ-ТЕСТ",cars:lang==="ky"?"АВТО ТЕСТ":"АВТО-ТЕСТ"};
    openModal(`<span class="eyebrow">${titleMap[currentQuiz]} • ${quizIndex+1}/5</span><h2 id="modalTitle">${escapeHtml(q.q)}</h2><p>${lang==="ky"?"Туура жооп үчүн 10 упай.":"За каждый правильный ответ — 10 очков."}</p><div id="quizOptions">${q.a.map((a,i)=>`<button class="quiz-option" data-answer="${i}">${escapeHtml(a)}</button>`).join("")}</div><div id="quizFeedback"></div>`);
  }
  function answerQuestion(btn){
    if(quizAnswered)return;quizAnswered=true;const qs=quizSets[currentQuiz][lang],q=qs[quizIndex],answer=Number(btn.dataset.answer),right=answer===q.correct;if(right)quizScore++;
    $$('[data-answer]').forEach(b=>{b.disabled=true;if(Number(b.dataset.answer)===q.correct)b.classList.add("correct");});if(!right)btn.classList.add("wrong");
    $("#quizFeedback").innerHTML=`<div class="result-box"><p>${right?(lang==="ky"?"Туура! +10 упай":"Верно! +10 очков"):(lang==="ky"?"Бул жолу туура эмес.":"В этот раз неверно.")}</p><p>${escapeHtml(q.why)}</p><button id="nextQuestion" class="btn btn-primary full">${quizIndex===4?(lang==="ky"?"Жыйынтык":"Результат"):(lang==="ky"?"Кийинки суроо →":"Следующий вопрос →")}</button></div>`;
  }

  function startGame(){
    openModal(`<span class="eyebrow">${lang==="ky"?"МИНИ-ОЮН":"МИНИ-ИГРА"}</span><h2 id="modalTitle">${lang==="ky"?"Реакцияңды текшер!":"Проверь реакцию!"}</h2><p>${lang==="ky"?"Стартты бас. Поле жашыл болгондо дароо бас — эрте баспа!":"Нажми «Старт». Когда поле станет зелёным, нажми как можно быстрее — не нажимай раньше!"}</p><div class="game-zone"><button id="reactionPad" class="reaction-pad">${lang==="ky"?"Стартты бас":"Нажми «Старт»"}</button><button id="gameStart" class="btn btn-primary full">${lang==="ky"?"Старт":"Старт"}</button><p class="muted-small">${lang==="ky"?"Рекорд азырынча ушул түзмөктө гана сакталат.":"Рекорд пока сохраняется только на этом устройстве."}</p></div>`);
    const pad=$("#reactionPad"),start=$("#gameStart");start.onclick=()=>{clearTimeout(reactionTimer);reactionState="wait";pad.className="reaction-pad wait";pad.textContent=lang==="ky"?"КҮТ...":"ЖДИ...";start.disabled=true;start.textContent=lang==="ky"?"Оюн жүрүп жатат…":"Игра идёт…";reactionTimer=setTimeout(()=>{reactionState="ready";reactionStart=performance.now();pad.className="reaction-pad ready";pad.textContent=lang==="ky"?"АЗЫР БАС!":"ЖМИ СЕЙЧАС!";},900+Math.random()*2900);};
    pad.onclick=()=>{if(reactionState==="wait"){clearTimeout(reactionTimer);reactionState="idle";pad.className="reaction-pad";pad.textContent=lang==="ky"?"Эрте басып койдуң! Кайра башта.":"Слишком рано! Попробуй ещё раз.";start.disabled=false;start.textContent=lang==="ky"?"Кайра баштоо":"Начать заново";}else if(reactionState==="ready"){const ms=Math.round(performance.now()-reactionStart);reactionState="done";if(!state.bestReaction||ms<state.bestReaction)state.bestReaction=ms;const reactionAward=Math.max(1,Math.min(25,Math.round(1000/ms)));state.points+=reactionAward;saveState();void awardCloudPoints("reaction",reactionAward,ms);pad.className="reaction-pad";pad.textContent=ms+" ms";start.disabled=false;start.textContent=lang==="ky"?"Кайра ойно":"Играть снова";showToast((lang==="ky"?"Реакцияң: ":"Твоя реакция: ")+ms+" ms · +"+reactionAward);}};
  }
  function openStudio(){
    openModal(`<span class="eyebrow">AZA STUDIO</span><h2 id="modalTitle">${lang==="ky"?"Креативдүү куралдар":"Креативные инструменты"}</h2><p>${lang==="ky"?"Бул версияда текст шаблондорунун генератору иштейт. Чыныгы AI-модель азырынча туташтырылган эмес.":"В этой версии работают генераторы на основе шаблонов. Настоящая AI-модель пока не подключена."}</p><label class="field-label" for="studioType">${lang==="ky"?"Эмне түзөбүз?":"Что создаём?"}</label><select id="studioType" class="text-field"><option value="post">${lang==="ky"?"Соцтармак үчүн пост":"Пост для соцсетей"}</option><option value="nick">${lang==="ky"?"Никнейм":"Никнейм"}</option><option value="idea">${lang==="ky"?"Видео идеясы":"Идея для видео"}</option></select><label class="field-label" for="studioTopic">${lang==="ky"?"Темаңды жаз":"Укажи тему"}</label><input id="studioTopic" class="text-field" placeholder="${lang==="ky"?"Мисалы: оюн, кино, дүкөн...":"Например: игры, кино, магазин..."}"><button id="generateStudio" class="btn btn-primary full" style="margin-top:14px">${lang==="ky"?"Түзүү ✨":"Создать ✨"}</button><div id="studioOutput"></div>`);
    $("#generateStudio").onclick=()=>{const topic=$("#studioTopic").value.trim()||(lang==="ky"?"кызыктуу тема":"интересная тема"),type=$("#studioType").value;let output="";if(type==="post")output=lang==="ky"?`🔥 ${topic.toUpperCase()} — жаңы деңгээл!\n\nСен даярсыңбы? Өз оюңду комментарийге жаз 👇\n\n#AZAUniverse #${topic.replace(/\s+/g,"")}`:`🔥 ${topic.toUpperCase()} — новый уровень!\n\nГотов попробовать? Напиши своё мнение в комментариях 👇\n\n#AZAUniverse #${topic.replace(/\s+/g,"")}`;if(type==="nick")output=[`AZA_${topic.replace(/\s+/g,"")}`,`${topic}_FIRE`,`x${topic}x`,`『${topic}』`,`亗${topic}亗`].join("\n");if(type==="idea")output=lang==="ky"?`Видео идеясы: «${topic} боюнча 3 факт»\n1. Биринчи секундда күчтүү суроо бер.\n2. Үч кыска факт же кеңеш көрсөт.\n3. Аягында көрүүчүгө суроо берип, бөлүшүүгө чакыр.`:`Идея видео: «3 факта о теме ${topic}»\n1. Начни с цепляющего вопроса.\n2. Покажи три коротких факта или совета.\n3. В конце задай вопрос и предложи поделиться мнением.`;$("#studioOutput").innerHTML=`<div class="output-box" id="studioResult">${escapeHtml(output)}</div><button id="copyStudio" class="btn btn-outline full" style="margin-top:10px">${lang==="ky"?"Көчүрүү":"Скопировать"}</button>`;$("#copyStudio").onclick=()=>copyText(output);};
  }
  function isSupabaseConfigured(){
    const url=String(supabaseConfig.projectUrl||"").trim();
    const key=String(supabaseConfig.publishableKey||"").trim();
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.startsWith("sb_publishable_") && !key.includes("REPLACE");
  }
  function updateAccountHeader(){
    const signedLabel=cloudUser?(cloudProfile?.username|| (lang==="ky"?"Аккаунт":"Аккаунт")):t("login");
    const label=$(".profile-btn [data-i18n='login']");if(label)label.textContent=signedLabel;
    const mobileLabel=$(".mobile-account-link [data-i18n='login']");if(mobileLabel)mobileLabel.textContent=signedLabel;
    const button=$(".profile-btn");if(button)button.title=cloudUser?(cloudProfile?.username||cloudUser.email||"AZA Account"):t("login");
  }
  async function initSupabase(){
    if(!isSupabaseConfigured())return;
    if(!window.supabase||typeof window.supabase.createClient!=="function")return;
    supabaseClient=window.supabase.createClient(supabaseConfig.projectUrl,supabaseConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data}=await supabaseClient.auth.getSession();
    await handleCloudUser(data?.session?.user||null,false);
    supabaseClient.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>{handleCloudUser(session?.user||null,true).catch(()=>{});},0);});
  }
  async function handleCloudUser(user,toastOnChange=false){
    const hadUser=!!cloudUser;cloudUser=user||null;cloudProfile=null;
    if(cloudUser)await refreshOwnProfile();
    updateAccountHeader();renderStats();await refreshLeaderboard();
    if(toastOnChange&&cloudUser&&!hadUser)showToast(t("authSignedIn"));
    if(toastOnChange&&!cloudUser&&hadUser)showToast(t("authSignedOut"));
  }
  async function refreshOwnProfile(){
    if(!supabaseClient||!cloudUser)return;
    const {data,error}=await supabaseClient.from("profiles").select("id,username,total_points,best_reaction_ms,created_at").eq("id",cloudUser.id).maybeSingle();
    if(error){console.warn("Could not load AZA profile",error.message);return;}
    cloudProfile=data||null;renderStats();
  }
  async function refreshLeaderboard(){
    if(!supabaseClient)return;
    const list=$("#ranking .ranking-list"),note=$("#rankingNote"),kicker=$("#rankingKicker");
    if(!list)return;
    if(kicker)kicker.textContent=t("onlineRankingLabel");
    const {data,error}=await supabaseClient.from("profiles").select("username,total_points,created_at").order("total_points",{ascending:false}).order("created_at",{ascending:true}).limit(5);
    if(error){if(note)note.textContent=t("rankingLoadError");console.warn("Leaderboard error",error.message);return;}
    if(!data||data.length===0){list.innerHTML="";if(note)note.textContent=t("noOnlinePlayers");return;}
    const avatarClasses=["avatar-one","avatar-two","avatar-three","avatar-four","avatar-five"];
    list.innerHTML=data.map((player,i)=>`<div class="ranking-item"><span class="rank-medal ${i===0?"gold-medal":i===1?"silver-medal":i===2?"bronze-medal":""}">${i+1}</span><span class="avatar ${avatarClasses[i]}">${escapeHtml((player.username||"A").slice(0,1).toUpperCase())}</span><strong>${escapeHtml(player.username||"AZA Player")}</strong><b>${Number(player.total_points||0).toLocaleString(lang==="ky"?"ky-KG":"ru-RU")}</b></div>`).join("");
    if(note)note.textContent=t("onlineRankingNote");
  }
  function showAuthMessage(message,kind=""){
    const el=$("#authMessage");if(!el)return;el.textContent=message;el.className="auth-message"+(kind?" "+kind:"");el.hidden=!message;
  }
  function openAuthForm(mode="signin",message="",messageKind=""){
    authMode=mode;
    if(!supabaseClient){
      const heading=window.supabase? t("authNotConfiguredTitle"):t("authUnavailable");
      openModal(`<span class="eyebrow">AZA ACCOUNT</span><h2 id="modalTitle">${escapeHtml(heading)}</h2><p>${escapeHtml(t("authNotConfiguredText"))}</p><p class="muted-small">Project URL жана Publishable key гана колдонулат. Secret key браузерге же чатка киргизилбейт.</p><button class="btn btn-primary full" data-close>${lang==="ky"?"Түшүнүктүү":"Понятно"}</button>`);return;
    }
    const isSignup=mode==="signup";
    openModal(`<span class="eyebrow">AZA ACCOUNT · ${isSignup?"SIGN UP":"SIGN IN"}</span><h2 id="modalTitle">${escapeHtml(t(isSignup?"authSignUp":"authSignIn"))}</h2><p>${escapeHtml(t("authHelp"))}</p><form id="authForm" class="auth-form" novalidate>${isSignup?`<label class="field-label" for="authUsername">${escapeHtml(t("authUsername"))}</label><input class="text-field" id="authUsername" name="username" type="text" minlength="3" maxlength="20" autocomplete="nickname" required>`:""}<label class="field-label" for="authEmail">${escapeHtml(t("authEmail"))}</label><input class="text-field" id="authEmail" name="email" type="email" autocomplete="email" required><label class="field-label" for="authPassword">${escapeHtml(t("authPassword"))}</label><input class="text-field" id="authPassword" name="password" type="password" minlength="8" autocomplete="${isSignup?"new-password":"current-password"}" required><p id="authMessage" class="auth-message" role="status" aria-live="polite" ${message?"":"hidden"}>${escapeHtml(message)}</p><button id="authSubmit" class="btn btn-primary full" type="submit">${escapeHtml(t(isSignup?"authSubmitSignUp":"authSubmitSignIn"))}</button></form><button id="authSwitch" class="btn btn-outline full auth-switch" type="button">${escapeHtml(t(isSignup?"authSwitchToSignIn":"authSwitchToSignUp"))}</button>`);
    if(message)showAuthMessage(message,messageKind);
    $("#authForm").addEventListener("submit",submitAuthForm);
    $("#authSwitch").addEventListener("click",()=>openAuthForm(authMode==="signup"?"signin":"signup"));
  }
  async function submitAuthForm(event){
    event.preventDefault();if(authBusy||!supabaseClient)return;
    const form=event.currentTarget,email=$("#authEmail").value.trim(),password=$("#authPassword").value,username=$("#authUsername")?.value.trim()||"";
    if(authMode==="signup"&&(username.length<3||username.length>20)){showAuthMessage(t("authBadUsername"),"error");return;}
    if(password.length<8){showAuthMessage(t("authBadPassword"),"error");return;}
    authBusy=true;const submit=$("#authSubmit");if(submit){submit.disabled=true;submit.textContent=t(authMode==="signup"?"authSigningUp":"authSigningIn");}
    let result;
    try{
      if(authMode==="signup"){
        result=await supabaseClient.auth.signUp({email,password,options:{data:{username},emailRedirectTo:location.origin}});
      }else result=await supabaseClient.auth.signInWithPassword({email,password});
      if(result.error){showAuthMessage(t("authGenericError"),"error");}
      else if(authMode==="signup"&&!result.data?.session){showAuthMessage(t("authCheckEmail"),"success");form.reset();}
      else{await handleCloudUser(result.data?.user||result.data?.session?.user||null,false);showToast(t("authSignedIn"));openProfile();}
    }catch(error){console.error("AZA auth error",error);showAuthMessage(t("authGenericError"),"error");}
    finally{authBusy=false;const current=$("#authSubmit");if(current){current.disabled=false;current.textContent=t(authMode==="signup"?"authSubmitSignUp":"authSubmitSignIn");}}
  }
  async function awardCloudPoints(source,amount,reactionMs=null){
    if(!supabaseClient||!cloudUser||!Number.isFinite(amount)||amount<1)return;
    try{
      const {data,error}=await supabaseClient.rpc("record_points",{p_source:source,p_amount:Math.min(source==="quiz"?50:25,Math.floor(amount)),p_reaction_ms:reactionMs});
      if(error){console.warn("Could not save online points",error.message);showToast(lang==="ky"?"Онлайн упай сакталган жок":"Онлайн-очки не сохранены");return;}
      if(data===0)showToast(lang==="ky"?"Бул аракет үчүн 24 сааттык упай чегине жеттиң.":"Достигнут лимит очков на 24 часа для этого действия.");
      await refreshOwnProfile();await refreshLeaderboard();
    }catch(error){console.warn("Online score unavailable",error);}
  }
  async function openProfile(){
    if(!isSupabaseConfigured()||!supabaseClient){openAuthForm("signin");return;}
    if(!cloudUser){openAuthForm("signin");return;}
    await refreshOwnProfile();
    const name=cloudProfile?.username||cloudUser.email||"AZA Player";
    openModal(`<span class="eyebrow">AZA ACCOUNT · ONLINE</span><h2 id="modalTitle">${lang==="ky"?"Менин аккаунтым":"Мой аккаунт"}</h2><div class="auth-user-card"><span class="auth-avatar">${escapeHtml(name.slice(0,1).toUpperCase())}</span><span class="auth-user-info"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(cloudUser.email||"")}</small></span></div><div class="result-box"><p>${escapeHtml(t("authOnlinePoints"))}</p><strong>${Number(cloudProfile?.total_points||0).toLocaleString(lang==="ky"?"ky-KG":"ru-RU")}</strong><p>${escapeHtml(t("authBestReaction"))}: ${cloudProfile?.best_reaction_ms?Number(cloudProfile.best_reaction_ms)+" ms":"—"}</p></div><button id="authSignOut" class="btn btn-outline full" type="button">${escapeHtml(t("authLogout"))}</button>`);
    $("#authSignOut").addEventListener("click",async()=>{const {error}=await supabaseClient.auth.signOut();if(error){showToast(t("authGenericError"));return;}cloudUser=null;cloudProfile=null;updateAccountHeader();renderStats();await refreshLeaderboard();closeModal();showToast(t("authSignedOut"));});
  }
  function openSearch(){
    openModal(`<span class="eyebrow">AZA SEARCH</span><h2 id="modalTitle">${lang==="ky"?"Эмне издейбиз?":"Что ищем?"}</h2><input class="text-field" id="searchInput" type="search" placeholder="${lang==="ky"?"Оюндар, тесттер, AI...":"Игры, тесты, AI..."}"><div id="searchResults" class="search-results"></div>`);
    const items=[{key:"navHome",href:"#home"},{key:"navGames",href:"#games"},{key:"navTests",href:"#tests"},{key:"navAI",href:"#tools"},{key:"navRanking",href:"#ranking"},{key:"navChallenges",href:"#challenge"}];
    const draw=(query="")=>{$("#searchResults").innerHTML=items.filter(x=>t(x.key).toLowerCase().includes(query.toLowerCase())).map(x=>`<a href="${x.href}" data-search-link>${escapeHtml(t(x.key))}<b>→</b></a>`).join("")||`<p>${lang==="ky"?"Эч нерсе табылган жок.":"Ничего не найдено."}</p>`;};draw();$("#searchInput").addEventListener("input",e=>draw(e.target.value));
  }
  async function copyText(text){try{await navigator.clipboard.writeText(text);showToast(lang==="ky"?"Көчүрүлдү!":"Скопировано!");}catch{const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();showToast(lang==="ky"?"Көчүрүлдү!":"Скопировано!");}}
  async function shareSite(){const data={title:"AZA UNIVERSE",text:lang==="ky"?"Кызыктуу тесттерди жана мини-оюндарды сынап көр!":"Попробуй интересные тесты и мини-игры!",url:location.href};if(navigator.share){try{await navigator.share(data);}catch(e){if(e.name!=="AbortError")showToast(lang==="ky"?"Бөлүшүү мүмкүн болгон жок":"Не удалось поделиться");}}else await copyText(data.text+" "+data.url);}

  document.addEventListener("click",e=>{
    const close=e.target.closest("[data-close]");if(close){closeModal();return;}
    const open=e.target.closest("[data-open]");if(open){e.preventDefault();if(open.closest("#mobileMenu")){const menu=$("#mobileMenu");menu.classList.remove("open");menu.setAttribute("aria-hidden","true");$("#menuToggle").textContent="☰";}const action=open.dataset.open;if(action==="quiz")startQuiz(open.dataset.quiz||"general");else if(action==="game")startGame();else if(action==="studio")openStudio();else if(action==="profile")openProfile();else if(action==="search")openSearch();else if(action==="share")shareSite();return;}
    const answer=e.target.closest("[data-answer]");if(answer){answerQuestion(answer);return;}
    if(e.target.closest("#nextQuestion")){quizIndex++;quizAnswered=false;renderQuestion();return;}
    if(e.target.closest("#quizAgain")){startQuiz(currentQuiz);return;}
    const searchLink=e.target.closest("[data-search-link]");if(searchLink){closeModal();setTimeout(()=>{const target=$(searchLink.getAttribute("href"));if(target)target.scrollIntoView({behavior:"smooth",block:"start"});},80);return;}
    const mobileLink=e.target.closest("#mobileMenu a");if(mobileLink){$("#mobileMenu").classList.remove("open");$("#mobileMenu").setAttribute("aria-hidden","true");}
  });
  $("#langToggle").addEventListener("click",()=>{lang=lang==="ky"?"ru":"ky";localStorage.setItem("aza-lang",lang);applyLanguage();showToast(lang==="ky"?"Кыргыз тили":"Русский язык");});
  $("#shareBtn").addEventListener("click",shareSite);
  $("#menuToggle").addEventListener("click",()=>{const menu=$("#mobileMenu"),open=menu.classList.toggle("open");menu.setAttribute("aria-hidden",String(!open));$("#menuToggle").textContent=open?"×":"☰";});
  $$(".mobile-bottom-nav a").forEach(a=>a.addEventListener("click",()=>{$$(".mobile-bottom-nav a").forEach(el=>el.classList.toggle("active",el===a));}));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
  const year=$("#year");if(year)year.textContent=new Date().getFullYear();
  applyLanguage();renderStats();
  initSupabase().catch(error=>console.warn("Supabase initialization failed",error));
})();
