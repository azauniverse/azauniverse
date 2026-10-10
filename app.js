(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = "aza-universe-v2";
  const LEGACY_KEY = "aza-universe-v1";
  const DATE_KEY = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  let lang = localStorage.getItem("aza-lang") || "ky";
  let toastTimer = 0;
  let reactionTimer = 0;
  let reactionStart = 0;
  let reactionState = "idle";
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;
  let currentPack = "general";
  let personalityAnswers = [];

  const readStorage = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || "{}");
      const today = DATE_KEY();
      return {
        points: Math.max(0, Number(parsed.points) || 0),
        bestReaction: Math.max(0, Number(parsed.bestReaction) || 0),
        dailyDate: parsed.dailyDate || "",
        dailyDone: !!parsed.dailyDone && parsed.dailyDate === today,
        testsCompleted: Math.max(0, Number(parsed.testsCompleted) || 0),
        bestQuizScore: parsed.bestQuizScore == null ? null : Number(parsed.bestQuizScore)
      };
    } catch {
      return { points: 0, bestReaction: 0, dailyDate: "", dailyDone: false, testsCompleted: 0, bestQuizScore: null };
    }
  };
  const state = readStorage();

  const copy = {
    ky: {
      tagline:"ТЕСТТЕР · ОЮНДАР · AI · КООМЧУЛУК",navHome:"Башкы бет",navGames:"Оюндар",navTests:"Тесттер",navAI:"AI куралдар",navRanking:"Рейтинг",navChallenge:"Чакырыктар",
      heroEyebrow:"СЕНИН ЖАҢЫ ИНТЕРНЕТ-ААЛАМЫҢ",heroPromise:"ТЕСТТЕР · ОЮНДАР · AI КУРАЛДАР · КООМЧУЛУК",heroText:"Кызыктуу тесттерден өт, мини-оюндарды ойно, жаңы идеяларды тап жана досторуң менен жарыш.",heroStart:"Ааламга кирүү",heroExplore:"Изилдеп көрүү",heroNote:"Акысыз башта. Өз рекордуңду жаңыла.",shortcutTests:"Кызыктуу тесттер",shortcutGames:"Мини-оюндар",shortcutAI:"AI куралдар",shortcutRanking:"Менин рекордум",shortcutDaily:"Күнүмдүк миссия",
      gamesOverline:"РЕКОРДУҢДУ ЖАҢЫЛА",gamesTitle:"Мини-оюндар",gamesText:"Реакцияңды сынап, өзүңдүн мыкты убактыңды кой.",playNow:"Азыр ойно",testsOverline:"БИЛИМИҢДИ СЫНАГЫН",testsTitle:"Кызыктуу тесттер",testsText:"Логика, аниме, унаалар жана башка темалар.",takeQuiz:"Тест өтүү",aiOverline:"КРЕАТИВДҮҮ КУРАЛДАР",aiTitle:"AZA Studio",aiText:"Посттун тексти, никнейм жана видео идеяларын түз.",openTools:"Куралдарды ач",scoreOverline:"ӨЗҮҢ МЕНЕН ЖАРЫШ",scoreTitle:"Рекорддор",scoreText:"Упайыңды, тест жыйынтыгын жана реакция рекордуңду кара.",showStats:"Статистиканы көрүү",challengeOverline:"КҮН САЙЫН ЖАҢЫЛАНАТ",challengeTitle:"Күнүмдүк чакырык",challengeText:"Бүгүнкү тапшырманы аткарып, активдүүлүгүңдү сакта.",startChallenge:"Чакырыкты баштоо",communityOverline:"ДОСТОР МЕНЕН БӨЛҮШ",communityTitle:"Коомчулук",communityText:"Натыйжаңды бөлүшүп, досторуңду чакыр.",inviteFriends:"Досту чакыруу",
      dailyLabel:"БҮГҮНКҮ ЧАКЫРЫК",dailyTitle:"Логикалык тест",dailyTaskText:"5 суроого жооп бер. Өзүңдү сына!",acceptChallenge:"Чакырыкты кабыл алуу",perfectScore:"МЫКТЫ ЖЫЙЫНТЫК",bonusPoints:"БОНУС УПАЙЛАР",popularEyebrow:"ӨЗҮҢДҮ ТАП",popularTitle:"Популярдуу тесттер",allTests:"Бардык тесттер",popular1:"Сен кайсы каармансың?",popular2:"Логикаң канчалык күчтүү?",popular3:"Сага кайсы унаа туура келет?",popular4:"Мүнөзүңдү ач",popularTry:"Популярдуу тест",quickTest:"Ыкчам тест",funTest:"Көңүлдүү тест",personalityTest:"Мүнөз тест",
      yourProgress:"СЕНИН ПРОГРЕССИҢ",statsTitle:"Жеке статистика",savedLocally:"Сакталат",points:"Упайлар",bestReaction:"Эң мыкты реакция",testsCompleted:"Өткөн тесттер",bestScore:"Жогорку тест упайы",localNotice:"Бул статистика ушул браузерде сакталат. Жалпы онлайн рейтинг үчүн сервердик система кийин кошулат.",creativeZone:"КРЕАТИВДҮҮ ЗОНА",studioTitle:"AZA Studio",studioIntro:"Идеяңды текстке айландыр. Ыкчам шаблондордон башта.",toolPost:"Пост тексти",toolPostSub:"Соцтармак үчүн",toolNick:"Никнейм",toolNickSub:"Өзгөчө ат ойлоп тап",toolIdea:"Видео идеясы",toolIdeaSub:"Жаңы контент үчүн",shareEyebrow:"КОМАНДА ЧОГУЛТ",shareTitle:"Ааламды досторуң менен бөлүш",shareText:"Кимдин реакциясы ылдам? Досторуңду чакырып, сынаш.",shareBtn:"Бөлүшүү",footerDescription:"Кызыктуу контент, оюндар жана креативдүү куралдар — бир ааламда.",footerNavigation:"Навигация",footerAbout:"Долбоор жөнүндө",footerFeatures:"Мүмкүнчүлүктөр",footerContact:"Байланыш",footerContactText:"Сунушуң барбы? Долбоорду досторуңа бөлүш.",rights:"Бардык укуктар корголгон.",
      quizLabel:"КЫЗЫКТУУ ТЕСТ",correct:"Туура!",wrong:"Бул жолу туура эмес.",next:"Кийинки суроо →",result:"Жыйынтык",retry:"Кайра өтүү",pointsEarned:"Топтогон упайың",quizFinished:"Тест бүттү! 🔥",perfect:"Мыкты! Бардык суроого туура жооп бердиң!",quizProgress:"Суроо",outOf:"ичинен",rightAnswer:"Туура жооп:",personalityResult:"Сенин профилиң",resultTypes:["План түзүүчү стратег","Креативдүү изилдөөчү","Тынч ойчул","Жигердүү лидер"],personalityDescriptions:["Сен алдын ала ойлонуп, иреттүү кадамдарды жактырасың.","Жаңы нерсени сынап көргөндү жана идея ойлоп тапканды жактырасың.","Сен кырдаалды байкап, чечимди ойлонуп кабыл аласың.","Сен демилге көтөрүп, аракет менен үйрөнгөндү жактырасың."],
      gameTitle:"Реакцияңды текшер!",gameText:"Стартты бас. Талаа жашыл болгондо дароо бас. Эрте бассаң, кайра башта.",gameStart:"Старт",gameWait:"КҮТ...",gameReady:"АЗЫР БАС!",gameEarly:"Эрте басып койдуң! Кайра башта.",gameAgain:"Кайра ойно",gameHelp:"Реакция рекорду ушул браузерде сакталат.",yourReaction:"Сенин реакцияң: ",
      studioTitleModal:"Креативдүү куралдар",studioDisclaimer:"Бул прототипте шаблондук генераторлор иштейт. Чыныгы AI-модель азырынча туташтырыла элек.",whatCreate:"Эмне түзөбүз?",createPost:"Соцтармак үчүн пост",createNick:"Никнейм",createIdea:"Видео идеясы",topicLabel:"Темаңды жаз",topicPlaceholder:"Мисалы: оюн, кино, дүкөн...",generate:"Түзүү ✨",copy:"Көчүрүү",copied:"Көчүрүлдү!",shareCopied:"Шилтемени көчүрдүк — досторуңа жибер!",searchTitle:"AZA UNIVERSE'тен издөө",searchPlaceholder:"Оюн, тест, AI курал...",noResults:"Тиешелүү бөлүм табылган жок.",myStats:"Менин статистикам",pointsShort:"Упай",quizzesShort:"Өткөн тесттер",reactionShort:"Мыкты реакция",searchHint:"Бөлүмдүн атын жаз же төмөнкүлөрдүн бирин танда.",
      footerShareHint:"AZA UNIVERSE'ти досуң менен бөлүш.",onlineNotice:"Эскертүү: жалпы онлайн рейтинг жана чыныгы AI кийинки этапта сервер аркылуу кошулат.",dailyBonus:"Күнүмдүк чакырык аткарылды! +50 бонус упай!",quizBonus:"Тест аяктады! Упай кошулду.",languageChanged:"Кыргыз тили тандалды.",
      packs:{general:"Жалпы билим тест",anime:"Аниме тест",iq:"Логика тест",cars:"Авто тест",personality:"Мүнөз тест"}
    },
    ru: {
      tagline:"ТЕСТЫ · ИГРЫ · AI · СООБЩЕСТВО",navHome:"Главная",navGames:"Игры",navTests:"Тесты",navAI:"AI-инструменты",navRanking:"Рейтинг",navChallenge:"Челленджи",
      heroEyebrow:"ТВОЯ НОВАЯ ИНТЕРНЕТ-ВСЕЛЕННАЯ",heroPromise:"ТЕСТЫ · ИГРЫ · AI-ИНСТРУМЕНТЫ · СООБЩЕСТВО",heroText:"Проходи интересные тесты, играй в мини-игры, находи новые идеи и соревнуйся с друзьями.",heroStart:"Войти во вселенную",heroExplore:"Исследовать",heroNote:"Начни бесплатно. Обнови свой рекорд.",shortcutTests:"Интересные тесты",shortcutGames:"Мини-игры",shortcutAI:"AI-инструменты",shortcutRanking:"Мой рекорд",shortcutDaily:"Ежедневная миссия",
      gamesOverline:"ОБНОВИ РЕКОРД",gamesTitle:"Мини-игры",gamesText:"Проверь реакцию и установи личный рекорд.",playNow:"Играть",testsOverline:"ПРОВЕРЬ СЕБЯ",testsTitle:"Интересные тесты",testsText:"Логика, аниме, автомобили и другие темы.",takeQuiz:"Пройти тест",aiOverline:"КРЕАТИВНЫЕ ИНСТРУМЕНТЫ",aiTitle:"AZA Studio",aiText:"Создавай тексты постов, никнеймы и идеи для видео.",openTools:"Открыть инструменты",scoreOverline:"СОРЕВНУЙСЯ С СОБОЙ",scoreTitle:"Рекорды",scoreText:"Смотри очки, результаты тестов и рекорд реакции.",showStats:"Посмотреть статистику",challengeOverline:"ОБНОВЛЯЕТСЯ КАЖДЫЙ ДЕНЬ",challengeTitle:"Ежедневный челлендж",challengeText:"Выполни сегодняшнее задание и поддерживай активность.",startChallenge:"Начать челлендж",communityOverline:"ДЕЛИСЬ С ДРУЗЬЯМИ",communityTitle:"Сообщество",communityText:"Делись результатами и приглашай друзей.",inviteFriends:"Пригласить друга",
      dailyLabel:"ЧЕЛЛЕНДЖ НА СЕГОДНЯ",dailyTitle:"Тест на логику",dailyTaskText:"Ответь на 5 вопросов. Проверь себя!",acceptChallenge:"Принять вызов",perfectScore:"ИДЕАЛЬНЫЙ РЕЗУЛЬТАТ",bonusPoints:"БОНУСНЫЕ ОЧКИ",popularEyebrow:"НАЙДИ СЕБЯ",popularTitle:"Популярные тесты",allTests:"Все тесты",popular1:"На какого героя ты похож?",popular2:"Насколько сильна твоя логика?",popular3:"Какой автомобиль тебе подходит?",popular4:"Узнай свой характер",popularTry:"Популярный тест",quickTest:"Быстрый тест",funTest:"Развлекательный тест",personalityTest:"Тест личности",
      yourProgress:"ТВОЙ ПРОГРЕСС",statsTitle:"Личная статистика",savedLocally:"Сохраняется",points:"Очки",bestReaction:"Лучшая реакция",testsCompleted:"Пройдено тестов",bestScore:"Лучший результат",localNotice:"Статистика хранится в этом браузере. Для общего онлайн-рейтинга позже потребуется серверная система.",creativeZone:"КРЕАТИВНАЯ ЗОНА",studioTitle:"AZA Studio",studioIntro:"Преврати идею в текст. Начни с быстрых шаблонов.",toolPost:"Текст поста",toolPostSub:"Для соцсетей",toolNick:"Никнейм",toolNickSub:"Придумай необычное имя",toolIdea:"Идея для видео",toolIdeaSub:"Для нового контента",shareEyebrow:"СОБЕРИ КОМАНДУ",shareTitle:"Поделись вселенной с друзьями",shareText:"Чья реакция быстрее? Пригласи друзей и соревнуйся.",shareBtn:"Поделиться",footerDescription:"Интересный контент, игры и креативные инструменты — в одной вселенной.",footerNavigation:"Навигация",footerAbout:"О проекте",footerFeatures:"Возможности",footerContact:"Связь",footerContactText:"Есть предложение? Поделись проектом с друзьями.",rights:"Все права защищены.",
      quizLabel:"ИНТЕРЕСНЫЙ ТЕСТ",correct:"Верно!",wrong:"В этот раз неверно.",next:"Следующий вопрос →",result:"Результат",retry:"Пройти ещё раз",pointsEarned:"Набрано очков",quizFinished:"Тест завершён! 🔥",perfect:"Отлично! Ты ответил на все вопросы правильно!",quizProgress:"Вопрос",outOf:"из",rightAnswer:"Правильный ответ:",personalityResult:"Твой профиль",resultTypes:["Стратег-планировщик","Креативный исследователь","Спокойный мыслитель","Энергичный лидер"],personalityDescriptions:["Ты любишь планировать наперёд и действовать последовательно.","Тебе нравится пробовать новое и придумывать идеи.","Ты наблюдаешь за ситуацией и тщательно выбираешь решение.","Ты проявляешь инициативу и учишься в процессе действия."],
      gameTitle:"Проверь реакцию!",gameText:"Нажми «Старт». Когда поле станет зелёным, нажми быстро. Если нажмёшь рано — начни заново.",gameStart:"Старт",gameWait:"ЖДИ...",gameReady:"ЖМИ СЕЙЧАС!",gameEarly:"Слишком рано! Попробуй ещё раз.",gameAgain:"Играть снова",gameHelp:"Рекорд реакции сохраняется в этом браузере.",yourReaction:"Твоя реакция: ",
      studioTitleModal:"Креативные инструменты",studioDisclaimer:"В прототипе работают шаблонные генераторы. Настоящая AI-модель пока не подключена.",whatCreate:"Что создаём?",createPost:"Пост для соцсетей",createNick:"Никнейм",createIdea:"Идея для видео",topicLabel:"Укажи тему",topicPlaceholder:"Например: игры, кино, магазин...",generate:"Создать ✨",copy:"Скопировать",copied:"Скопировано!",shareCopied:"Ссылка скопирована — отправь друзьям!",searchTitle:"Поиск по AZA UNIVERSE",searchPlaceholder:"Игра, тест, AI-инструмент...",noResults:"Подходящий раздел не найден.",myStats:"Моя статистика",pointsShort:"Очки",quizzesShort:"Тестов пройдено",reactionShort:"Лучшая реакция",searchHint:"Напиши название раздела или выбери один из вариантов ниже.",
      footerShareHint:"Поделись AZA UNIVERSE с другом.",onlineNotice:"Важно: общий онлайн-рейтинг и настоящий AI будут добавлены на следующем этапе через сервер.",dailyBonus:"Ежедневный челлендж выполнен! +50 бонусных очков!",quizBonus:"Тест пройден! Очки добавлены.",languageChanged:"Выбран русский язык.",
      packs:{general:"Общий тест знаний",anime:"Аниме-тест",iq:"Логический тест",cars:"Авто-тест",personality:"Тест личности"}
    }
  };

  const questionPacks = {
    general: {
      ky:[
        {q:"Кыргызстандын борбору кайсы шаар?",a:["Ош","Бишкек","Талас","Нарын"],correct:1,why:"Бишкек — Кыргызстандын борбору."},
        {q:"Бир саатта канча мүнөт бар?",a:["30","50","60","100"],correct:2,why:"Бир саат 60 мүнөттөн турат."},
        {q:"Күн системасындагы эң чоң планета кайсы?",a:["Марс","Жер","Сатурн","Юпитер"],correct:3,why:"Юпитер — Күн системасындагы эң чоң планета."},
        {q:"HTML негизинен эмне үчүн колдонулат?",a:["Веб-барактын түзүлүшү","Сүрөт тартуу гана","Маалымат базасын сактоо","Интернетти тездетүү"],correct:0,why:"HTML веб-барактын түзүлүшүн жана мазмунун белгилейт."},
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
    anime: {
      ky:[
        {q:"Наруто кайсы айылдан чыккан?",a:["Коноха","Суна","Кири","Ива"],correct:0,why:"Наруто — Жашыруун Жалбырак айылынын шинобиси."},
        {q:"One Piece'те башкы каарман ким?",a:["Зоро","Санджи","Монки Д. Луффи","Трафальгар Ло"],correct:2,why:"Окуянын башкы каарманы — Монки Д. Луффи."},
        {q:"Demon Slayer'дин башкы каарманы ким?",a:["Иноске","Танджиро","Гию","Муичиро"],correct:1,why:"Танджиро Камадо — башкы каарман."},
        {q:"Pokémon'догу Пикачу кандай жандык?",a:["Суу","От","Электр","Жер"],correct:2,why:"Пикачу — электр тибиндеги Покемон."},
        {q:"Dragon Ball'дагы Гоку эмнени жакшы көрөт?",a:["Тамакты жана машыгууну","Сүрөт тартууну","Уктай берүүнү гана","Китеп чогултууну"],correct:0,why:"Гоку тамакты жана күчтүү атаандаштар менен машыгууну жакшы көрөт."}
      ],
      ru:[
        {q:"Из какой деревни родом Наруто?",a:["Коноха","Суна","Кири","Ива"],correct:0,why:"Наруто — шиноби Деревни Скрытого Листа."},
        {q:"Кто главный герой One Piece?",a:["Зоро","Санджи","Монки Д. Луффи","Трафальгар Ло"],correct:2,why:"Главный герой истории — Монки Д. Луффи."},
        {q:"Кто главный герой Demon Slayer?",a:["Иноске","Танджиро","Гию","Муичиро"],correct:1,why:"Танджиро Камадо — главный герой."},
        {q:"Какого типа Пикачу из Pokémon?",a:["Водный","Огненный","Электрический","Земляной"],correct:2,why:"Пикачу относится к электрическому типу."},
        {q:"Что любит Гоку из Dragon Ball?",a:["Еду и тренировки","Рисование","Только сон","Коллекционирование книг"],correct:0,why:"Гоку любит поесть и тренироваться с сильными соперниками."}
      ]
    },
    iq: {
      ky:[
        {q:"Катарды улант: 2, 4, 8, 16, ...?",a:["18","24","32","36"],correct:2,why:"Ар бир сан эки эселенет: кийинкиси 32."},
        {q:"Үч мышык үч чычканды үч мүнөттө кармаса, бир мышык бир чычканды канча убакытта кармайт?",a:["1 мүнөт","3 мүнөт","9 мүнөт","Белгисиз"],correct:1,why:"Ар бир мышык бир чычканды 3 мүнөттө кармайт."},
        {q:"Кайсы сан башкаларынан айырмаланат?",a:["9","16","25","27"],correct:3,why:"9, 16, 25 — квадрат сандар; 27 эмес."},
        {q:"Бир километрде канча метр бар?",a:["100","500","1000","10000"],correct:2,why:"1 километр = 1000 метр."},
        {q:"Кечээ жекшемби болсо, эртең кайсы күн?",a:["Дүйшөмбү","Шейшемби","Шаршемби","Ишемби"],correct:1,why:"Кечээ жекшемби, бүгүн дүйшөмбү, эртең шейшемби."}
      ],
      ru:[
        {q:"Продолжи ряд: 2, 4, 8, 16, ...?",a:["18","24","32","36"],correct:2,why:"Каждое число удваивается: следующее — 32."},
        {q:"Три кошки ловят трёх мышей за три минуты. За сколько одна кошка поймает одну мышь?",a:["1 минуту","3 минуты","9 минут","Нельзя определить"],correct:1,why:"Каждая кошка ловит одну мышь за 3 минуты."},
        {q:"Какое число отличается от остальных?",a:["9","16","25","27"],correct:3,why:"9, 16 и 25 — квадраты целых чисел; 27 — нет."},
        {q:"Сколько метров в одном километре?",a:["100","500","1000","10000"],correct:2,why:"1 километр = 1000 метров."},
        {q:"Если вчера было воскресенье, какой день будет завтра?",a:["Понедельник","Вторник","Среда","Суббота"],correct:1,why:"Вчера воскресенье, сегодня понедельник, завтра вторник."}
      ]
    },
    cars: {
      ky:[
        {q:"Кайсы өлкө Toyota брендинин мекени?",a:["АКШ","Япония","Германия","Италия"],correct:1,why:"Toyota — Япониянын автомобиль өндүрүүчүсү."},
        {q:"Электр унаасы негизинен эмнени колдонот?",a:["Электр моторун","Буу кыймылдаткычын","Дизелди гана","Желди"],correct:0,why:"Электр унаасында негизги кыймылдаткыч электр мотору болот."},
        {q:"Коопсуздук куру эмне үчүн керек?",a:["Салонду кооздоо","Кырсыкта жаракат алуу коркунучун азайтуу","Күйүүчү май үнөмдөө","Моторду муздатуу"],correct:1,why:"Коопсуздук куру кагылышууда адамды кармап, жаракат коркунучун азайтат."},
        {q:"Ferrari бренди кайсы өлкөдөн?",a:["Франция","Италия","Канада","Швеция"],correct:1,why:"Ferrari — Италиянын спорттук унаа бренди."},
        {q:"Мотор майынын негизги милдеттеринин бири кайсы?",a:["Үйдү жылытуу","Тетиктердин сүрүлүүсүн азайтуу","Дөңгөлөктү үйлөө","Фараны күйгүзүү"],correct:1,why:"Майлоочу май кыймылдаткычтын тетиктеринин сүрүлүүсүн азайтат."}
      ],
      ru:[
        {q:"Какая страна является родиной бренда Toyota?",a:["США","Япония","Германия","Италия"],correct:1,why:"Toyota — японский автопроизводитель."},
        {q:"Что в основном использует электромобиль?",a:["Электродвигатель","Паровой двигатель","Только дизель","Ветер"],correct:0,why:"Основной привод электромобиля — электрический мотор."},
        {q:"Для чего нужен ремень безопасности?",a:["Для украшения салона","Чтобы снизить риск травм при аварии","Для экономии топлива","Для охлаждения двигателя"],correct:1,why:"Ремень удерживает человека и снижает риск травм при столкновении."},
        {q:"Из какой страны бренд Ferrari?",a:["Франция","Италия","Канада","Швеция"],correct:1,why:"Ferrari — итальянский бренд спортивных автомобилей."},
        {q:"Какова одна из главных задач моторного масла?",a:["Обогревать дом","Уменьшать трение деталей","Накачивать шины","Включать фары"],correct:1,why:"Масло снижает трение между деталями двигателя."}
      ]
    },
    personality: {
      ky:[
        {q:"Эс алуу күнү кайсыны тандайсың?",a:["Баарын алдын ала пландайм","Жаңы жерге барам","Тынч эс алам","Досторду чогултам"],kind:"profile"},
        {q:"Татаал маселе чыкса, сен...",a:["План түзөм","Башкача чечим ойлоном","Жакшылап байкайм","Дароо аракет кылам"],kind:"profile"},
        {q:"Командада көбүнчө кайсы ролду аласың?",a:["Уюштуруучу","Идея берүүчү","Угуучу жана байкоочу","Лидер"],kind:"profile"},
        {q:"Кайсы сөз сага жакыныраак?",a:["Тартип","Креатив","Тең салмак","Аракет"],kind:"profile"},
        {q:"Жаңы нерсени кандай үйрөнөсүң?",a:["Кадам-кадам менен","Сынап көрүп","Ойлонуп, талдап","Дароо колдонуп"],kind:"profile"}
      ],
      ru:[
        {q:"Как ты предпочитаешь провести выходной?",a:["Всё заранее спланирую","Исследую новое место","Спокойно отдохну","Соберу друзей"],kind:"profile"},
        {q:"Когда появляется сложная задача, ты...",a:["Составляю план","Придумываю нестандартное решение","Сначала наблюдаю","Сразу действую"],kind:"profile"},
        {q:"Какую роль чаще берёшь в команде?",a:["Организатор","Генератор идей","Наблюдатель и слушатель","Лидер"],kind:"profile"},
        {q:"Какое слово тебе ближе?",a:["Порядок","Креативность","Баланс","Действие"],kind:"profile"},
        {q:"Как ты осваиваешь новое?",a:["Пошагово","Через эксперименты","Через анализ","Сразу применяю"],kind:"profile"}
      ]
    }
  };

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Private browsing can block persistent storage. */ }
    renderStats();
  }
  function tr(key) { return copy[lang][key] ?? copy.ky[key] ?? key; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])); }
  function applyLanguage() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(element => {
      const key = element.dataset.i18n;
      if (copy[lang][key] !== undefined && typeof copy[lang][key] === "string") element.textContent = copy[lang][key];
    });
    $$('.lang-choice').forEach(button => button.classList.toggle('selected', button.dataset.lang === lang));
    updateDailyProgress();
  }
  function updateDailyProgress() {
    const done = state.dailyDone && state.dailyDate === DATE_KEY();
    const progress = $('#dailyProgress');
    const label = $('#dailyProgressText');
    if (progress) progress.style.width = done ? '100%' : '0%';
    if (label) label.textContent = done ? '5/5' : '0/5';
  }
  function renderStats() {
    if ($('#pointsTotal')) $('#pointsTotal').textContent = state.points.toLocaleString(lang === 'ky' ? 'ky-KG' : 'ru-RU');
    if ($('#bestReaction')) $('#bestReaction').textContent = state.bestReaction ? String(state.bestReaction) : '—';
    if ($('#testsCompleted')) $('#testsCompleted').textContent = state.testsCompleted;
    if ($('#bestQuizScore')) $('#bestQuizScore').textContent = state.bestQuizScore == null ? '—' : `${state.bestQuizScore}/5`;
    updateDailyProgress();
  }
  function showToast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2400);
  }
  function openModal(content) {
    $('#modalContent').innerHTML = content;
    $('#modal').classList.add('show');
    $('#modal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const firstFocusable = $('#modalContent button, #modalContent input, #modalContent select');
    if (firstFocusable) setTimeout(() => firstFocusable.focus({preventScroll:true}), 30);
  }
  function closeModal() {
    $('#modal').classList.remove('show');
    $('#modal').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    clearTimeout(reactionTimer);
    reactionState = 'idle';
  }
  function packTitle(pack) { return copy[lang].packs[pack] || copy[lang].packs.general; }

  function startQuiz(pack = 'general') {
    currentPack = questionPacks[pack] ? pack : 'general';
    quizIndex = 0;
    quizScore = 0;
    quizAnswered = false;
    personalityAnswers = [];
    renderQuestion();
  }
  function renderQuestion() {
    const questions = questionPacks[currentPack][lang];
    const question = questions[quizIndex];
    if (!question) return finishQuiz();
    const isPersonality = currentPack === 'personality';
    openModal(`<span class="eyebrow">${escapeHtml(packTitle(currentPack).toUpperCase())} · ${quizIndex + 1}/5</span><h2 id="modalTitle">${escapeHtml(question.q)}</h2><p>${isPersonality ? escapeHtml(lang === 'ky' ? 'Өзүңө жакын жоопту танда.' : 'Выбери ответ, который больше похож на тебя.') : escapeHtml(lang === 'ky' ? 'Туура жооп үчүн 10 упай.' : '10 очков за правильный ответ.')}</p><div id="quizOptions">${question.a.map((answer, index) => `<button class="quiz-option" type="button" data-answer="${index}">${escapeHtml(answer)}</button>`).join('')}</div><div id="quizFeedback"></div>`);
    $$('[data-answer]').forEach(button => button.addEventListener('click', () => {
      if (quizAnswered) return;
      quizAnswered = true;
      const answer = Number(button.dataset.answer);
      const correct = question.correct === answer;
      if (isPersonality) personalityAnswers.push(answer);
      else if (correct) quizScore++;
      $$('[data-answer]').forEach(option => {
        option.disabled = true;
        if (!isPersonality && Number(option.dataset.answer) === question.correct) option.classList.add('correct');
      });
      if (!isPersonality && !correct) button.classList.add('wrong');
      const feedback = isPersonality
        ? (lang === 'ky' ? 'Жооп сакталды.' : 'Ответ сохранён.')
        : (correct ? `${tr('correct')} +10` : `${tr('wrong')} ${tr('rightAnswer')} ${question.a[question.correct]}`);
      const explanation = !isPersonality && question.why ? `<p>${escapeHtml(question.why)}</p>` : '';
      $('#quizFeedback').innerHTML = `<div class="result-box"><p>${escapeHtml(feedback)}</p>${explanation}<button id="nextQuestion" class="btn btn-primary full" type="button">${quizIndex === 4 ? escapeHtml(tr('result')) : escapeHtml(tr('next'))}</button></div>`;
      $('#nextQuestion').addEventListener('click', () => { quizIndex++; quizAnswered = false; renderQuestion(); });
    }));
  }
  function finishQuiz() {
    const isPersonality = currentPack === 'personality';
    let earned = 0;
    let mainResult = '';
    let extra = '';
    state.testsCompleted++;
    if (isPersonality) {
      const counts = [0,0,0,0];
      personalityAnswers.forEach(answer => { counts[answer]++; });
      const profileIndex = counts.indexOf(Math.max(...counts));
      mainResult = tr('personalityResult');
      extra = `<p>${escapeHtml(tr('resultTypes')[profileIndex])}</p><p>${escapeHtml(tr('personalityDescriptions')[profileIndex])}</p>`;
      earned = 25;
    } else {
      earned = quizScore * 10;
      if (state.bestQuizScore == null || quizScore > state.bestQuizScore) state.bestQuizScore = quizScore;
    }
    state.points += earned;
    const dailyWasDone = state.dailyDone && state.dailyDate === DATE_KEY();
    if (!dailyWasDone) {
      state.dailyDate = DATE_KEY();
      state.dailyDone = true;
      if (!isPersonality && quizScore === 5) {
        state.points += 50;
        extra += `<p style="color:#ffcf73;font-weight:800">${escapeHtml(tr('dailyBonus'))}</p>`;
      }
    }
    saveState();
    const scoreText = isPersonality ? (lang === 'ky' ? '25 упай' : '25 очков') : `${quizScore}/5`;
    const standardExtra = isPersonality ? '' : `<p>${escapeHtml(tr('pointsEarned'))}: ${earned}${earned ? ' ✦' : ''}</p>${quizScore === 5 ? `<p style="color:#8ef4bf">${escapeHtml(tr('perfect'))}</p>` : ''}`;
    openModal(`<span class="eyebrow">${escapeHtml(tr('quizFinished').toUpperCase())}</span><h2 id="modalTitle">${isPersonality ? escapeHtml(mainResult) : escapeHtml(tr('result'))}</h2><div class="result-box"><strong>${escapeHtml(scoreText)}</strong>${standardExtra}</div>${extra}<button class="btn btn-primary full" id="quizAgain" type="button">${escapeHtml(tr('retry'))}</button>`);
    $('#quizAgain').addEventListener('click', () => startQuiz(currentPack));
    if (!dailyWasDone) showToast(quizScore === 5 && !isPersonality ? tr('dailyBonus') : tr('quizBonus'));
  }

  function startGame() {
    openModal(`<span class="eyebrow">${lang === 'ky' ? 'МИНИ-ОЮН' : 'МИНИ-ИГРА'}</span><h2 id="modalTitle">${escapeHtml(tr('gameTitle'))}</h2><p>${escapeHtml(tr('gameText'))}</p><div class="game-zone"><button id="reactionPad" class="reaction-pad" type="button">${escapeHtml(tr('gameStart'))}</button><button id="gameStart" class="btn btn-primary full" type="button">${escapeHtml(tr('gameStart'))}</button><p class="muted-small">${escapeHtml(tr('gameHelp'))}</p></div>`);
    const pad = $('#reactionPad');
    const start = $('#gameStart');
    start.addEventListener('click', () => {
      clearTimeout(reactionTimer);
      reactionState = 'wait';
      pad.className = 'reaction-pad wait';
      pad.textContent = tr('gameWait');
      start.disabled = true;
      start.textContent = lang === 'ky' ? 'Оюн жүрүп жатат…' : 'Игра идёт…';
      reactionTimer = setTimeout(() => {
        reactionState = 'ready';
        reactionStart = performance.now();
        pad.className = 'reaction-pad ready';
        pad.textContent = tr('gameReady');
      }, 900 + Math.random() * 2600);
    });
    pad.addEventListener('click', () => {
      if (reactionState === 'wait') {
        clearTimeout(reactionTimer);
        reactionState = 'idle';
        pad.className = 'reaction-pad';
        pad.textContent = tr('gameEarly');
        start.disabled = false;
        start.textContent = tr('gameAgain');
      } else if (reactionState === 'ready') {
        const ms = Math.max(1, Math.round(performance.now() - reactionStart));
        reactionState = 'done';
        if (!state.bestReaction || ms < state.bestReaction) state.bestReaction = ms;
        const earned = Math.max(1, Math.round(700 / ms));
        state.points += earned;
        saveState();
        pad.className = 'reaction-pad';
        pad.textContent = `${ms} ms`;
        start.disabled = false;
        start.textContent = tr('gameAgain');
        showToast(`${tr('yourReaction')}${ms} ms · +${earned}`);
      }
    });
  }

  function openStudio(initialType = 'post') {
    openModal(`<span class="eyebrow">AZA STUDIO</span><h2 id="modalTitle">${escapeHtml(tr('studioTitleModal'))}</h2><p>${escapeHtml(tr('studioDisclaimer'))}</p><label class="field-label" for="studioType">${escapeHtml(tr('whatCreate'))}</label><select id="studioType" class="text-field"><option value="post">${escapeHtml(tr('createPost'))}</option><option value="nick">${escapeHtml(tr('createNick'))}</option><option value="idea">${escapeHtml(tr('createIdea'))}</option></select><label class="field-label" for="studioTopic">${escapeHtml(tr('topicLabel'))}</label><input id="studioTopic" class="text-field" placeholder="${escapeHtml(tr('topicPlaceholder'))}" maxlength="90"><button id="generateStudio" class="btn btn-primary full" style="margin-top:14px" type="button">${escapeHtml(tr('generate'))}</button><div id="studioOutput"></div>`);
    $('#studioType').value = ['post','nick','idea'].includes(initialType) ? initialType : 'post';
    $('#generateStudio').addEventListener('click', generateStudioOutput);
    $('#studioTopic').addEventListener('keydown', event => { if (event.key === 'Enter') generateStudioOutput(); });
  }
  function generateStudioOutput() {
    const topic = $('#studioTopic').value.trim() || (lang === 'ky' ? 'кызыктуу тема' : 'интересная тема');
    const safeTag = topic.replace(/[^\p{L}\p{N}_]/gu, '').slice(0,40) || 'AZA';
    const type = $('#studioType').value;
    let output = '';
    if (type === 'post') output = lang === 'ky'
      ? `🔥 ${topic.toUpperCase()} — жаңы деңгээл!\n\nСен даярсыңбы? Өз оюңду комментарийге жаз 👇\n\n#AZAUniverse #${safeTag}`
      : `🔥 ${topic.toUpperCase()} — новый уровень!\n\nГотов попробовать? Напиши своё мнение в комментариях 👇\n\n#AZAUniverse #${safeTag}`;
    if (type === 'nick') output = [`AZA_${safeTag}`, `${safeTag}_FIRE`, `x${safeTag}x`, `『${safeTag}』`, `亗${safeTag}亗`].join('\n');
    if (type === 'idea') output = lang === 'ky'
      ? `Видео идеясы: «${topic} боюнча 3 факт»\n1. Биринчи секундда күчтүү суроо бер.\n2. Үч кыска факт же кеңеш көрсөт.\n3. Аягында көрүүчүгө суроо берип, бөлүшүүгө чакыр.`
      : `Идея видео: «3 факта о теме ${topic}»\n1. Начни с цепляющего вопроса.\n2. Покажи три коротких факта или совета.\n3. В конце задай вопрос и предложи поделиться мнением.`;
    $('#studioOutput').innerHTML = `<div class="output-box" id="studioResult">${escapeHtml(output)}</div><button id="copyStudio" class="btn btn-outline full" style="margin-top:10px" type="button">${escapeHtml(tr('copy'))}</button>`;
    $('#copyStudio').addEventListener('click', () => copyText(output));
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.appendChild(area); area.select(); const copied = document.execCommand('copy'); area.remove();
        if (!copied) throw new Error('Copy was blocked');
      }
      showToast(tr('copied'));
    } catch {
      showToast(lang === 'ky' ? 'Көчүрүү мүмкүн болгон жок. Текстти белгилеп көчүр.' : 'Не удалось скопировать. Выдели и скопируй текст.');
    }
  }
  async function shareSite() {
    const shareData = {title:'AZA UNIVERSE',text:lang === 'ky' ? 'AZA UNIVERSE — кызыктуу тесттер жана мини-оюндар! Кошул!' : 'AZA UNIVERSE — интересные тесты и мини-игры! Присоединяйся!',url:location.href};
    if (navigator.share) {
      try { await navigator.share(shareData); }
      catch (error) { if (error?.name !== 'AbortError') copyText(`${shareData.text} ${shareData.url}`); }
    } else {
      await copyText(`${shareData.text} ${shareData.url}`);
    }
  }

  function openSearch() {
    const sectionList = [
      {id:'games',title:tr('gamesTitle'),desc:tr('gamesText')},{id:'tests',title:tr('testsTitle'),desc:tr('testsText')},
      {id:'studio',title:tr('aiTitle'),desc:tr('aiText')},{id:'ranking',title:tr('statsTitle'),desc:tr('localNotice')},
      {id:'challenge',title:tr('challengeTitle'),desc:tr('challengeText')},{id:'community',title:tr('communityTitle'),desc:tr('communityText')}
    ];
    openModal(`<span class="eyebrow">AZA UNIVERSE</span><h2 id="modalTitle">${escapeHtml(tr('searchTitle'))}</h2><p>${escapeHtml(tr('searchHint'))}</p><input id="siteSearch" class="text-field" type="search" placeholder="${escapeHtml(tr('searchPlaceholder'))}" autocomplete="off"><div class="search-results" id="searchResults">${sectionList.map(item=>`<a class="search-result" href="#${item.id}" data-result="${item.id}"><span><b>${escapeHtml(item.title)}</b><br><small>${escapeHtml(item.desc)}</small></span><span>↗</span></a>`).join('')}</div>`);
    const input = $('#siteSearch');
    input.addEventListener('input', () => {
      const query = input.value.trim().toLocaleLowerCase();
      let matches = 0;
      $$('.search-result').forEach(result => {
        const visible = !query || result.textContent.toLocaleLowerCase().includes(query) || result.dataset.result.includes(query);
        result.hidden = !visible;
        if (visible) matches++;
      });
      let empty = $('#searchEmpty');
      if (!matches) {
        if (!empty) { empty = document.createElement('p'); empty.id = 'searchEmpty'; empty.style.color = '#a8bad0'; empty.textContent = tr('noResults'); $('#searchResults').appendChild(empty); }
      } else empty?.remove();
    });
    $$('[data-result]').forEach(result => result.addEventListener('click', () => { closeModal(); setTimeout(() => document.getElementById(result.dataset.result)?.scrollIntoView({behavior:'smooth',block:'start'}), 80); }));
  }
  function openProfile() {
    openModal(`<span class="eyebrow">AZA UNIVERSE · ${escapeHtml(tr('myStats').toUpperCase())}</span><h2 id="modalTitle">${escapeHtml(tr('myStats'))}</h2><p>${escapeHtml(tr('localNotice'))}</p><div class="profile-summary"><div><small>${escapeHtml(tr('pointsShort'))}</small><strong>${state.points.toLocaleString(lang === 'ky' ? 'ky-KG' : 'ru-RU')}</strong></div><div><small>${escapeHtml(tr('quizzesShort'))}</small><strong>${state.testsCompleted}</strong></div><div><small>${escapeHtml(tr('reactionShort'))}</small><strong>${state.bestReaction ? `${state.bestReaction} ms` : '—'}</strong></div><div><small>${escapeHtml(tr('bestScore'))}</small><strong>${state.bestQuizScore == null ? '—' : `${state.bestQuizScore}/5`}</strong></div></div><button class="btn btn-primary full" style="margin-top:16px" type="button" id="profileStartQuiz">${escapeHtml(tr('takeQuiz'))} →</button>`);
    $('#profileStartQuiz').addEventListener('click', () => startQuiz('general'));
  }

  $$('[data-open]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.open;
    if (action === 'quiz') startQuiz(button.dataset.quizType || 'general');
    if (action === 'game') startGame();
    if (action === 'studio') openStudio(button.dataset.studioType || 'post');
  }));
  $$('[data-close]').forEach(button => button.addEventListener('click', closeModal));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
  $$('.lang-choice').forEach(button => button.addEventListener('click', () => {
    if (!['ky','ru'].includes(button.dataset.lang)) return;
    lang = button.dataset.lang;
    try { localStorage.setItem('aza-lang', lang); } catch { /* Language still changes for this session. */ }
    applyLanguage(); renderStats();
    showToast(tr('languageChanged'));
  }));
  $('#shareBtn')?.addEventListener('click', shareSite);
  $('#communityShare')?.addEventListener('click', shareSite);
  $('#footerShare')?.addEventListener('click', shareSite);
  $('#footerContactBtn')?.addEventListener('click', shareSite);
  $('#searchOpen')?.addEventListener('click', openSearch);
  $('#profileOpen')?.addEventListener('click', openProfile);
  $('#showStats')?.addEventListener('click', openProfile);
  $('#year').textContent = new Date().getFullYear();

  const navTargets = ['home','games','tests','studio','ranking','challenge'];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      const section = visible.target.id;
      $$('.nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${section}` || (section === 'home' && link.getAttribute('href') === '#home')));
      $$('.mobile-nav-item').forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${section}` || (section === 'home' && link.getAttribute('href') === '#home')));
    }, {rootMargin:'-20% 0px -60% 0px',threshold:[0,.15,.4]});
    navTargets.forEach(id => { const target = document.getElementById(id); if (target) observer.observe(target); });
  }
  applyLanguage();
  renderStats();
})();
