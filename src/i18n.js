export const LANGUAGE_KEY = 'city-atlas-language'
export const LANGUAGES = [
  ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['en', 'English'],
  ['ja', '日本語'], ['ko', '한국어'], ['es', 'Español'], ['fr', 'Français'],
  ['de', 'Deutsch'], ['pt', 'Português'], ['ru', 'Русский']
]

export const messages = {
  'zh-CN': {
    language: '语言', cityAtlas: '城市罗盘', model: '实现模型', switchModel: '切换实现模型',
    anotherCity: '另一座城市', settings: '城市设置', collapseSettings: '收起设置', closeSettings: '关闭设置',
    github: 'GitHub 仓库', githubTitle: '在 GitHub 查看源码', notebook: '城市手记',
    now: '此刻', localTime: '本地时间', day: '白昼', night: '夜晚', resume: '继续模拟', pause: '暂停模拟',
    cityTime: '城市时间', speed: '时间流速', weather: '天气', atmosphere: '气象',
    sun: '晴', rain: '雨', snow: '雪', sunLabel: '晴天', rainLabel: '雨天', snowLabel: '雪天',
    generation: '城市基因', generationLabel: '生成', seed: '地图种子', random: '随机生成城市',
    density: '建筑密度', size: '罗盘尺寸', standard: '标准', large: '大型', vast: '广域', generate: '生成城市',
    buildings: '建筑', trees: '树木', bridges: '桥梁', credit: '3D 素材：Kenney · CC0',
    viewControls: '视角控制', overhead: '俯视地图', orbit: '旋转视角', pan: '平移视角', zoomIn: '放大',
    zoomOut: '缩小', reset: '回到全景', autoOrbit: '自动环绕', export: '导出城市图片',
    loading2d: '绘制城市与街巷', loadingPlan: '规划地形与航线', loadingModels: '装载城市模型',
    loadingTerrain: '构建山川与街巷', loadingLights: '准备夜景与光影', loadError: '城市未能完成加载', retry: '重新加载',
    canvas3d: '可旋转的三维城市', canvas2d: '可缩放和平移的城市地图',
    bayTown: '海湾城镇', riverValley: '曲流河谷', lakeside: '湖畔街区', islands: '岛屿聚落', cape: '岬角海岸', rivers: '交汇河网'
  },
  'zh-TW': {
    language: '語言', cityAtlas: '城市羅盤', model: '實作模型', switchModel: '切換實作模型',
    anotherCity: '另一座城市', settings: '城市設定', collapseSettings: '收起設定', closeSettings: '關閉設定',
    github: 'GitHub 儲存庫', githubTitle: '在 GitHub 檢視原始碼', notebook: '城市手記',
    now: '此刻', localTime: '當地時間', day: '白晝', night: '夜晚', resume: '繼續模擬', pause: '暫停模擬',
    cityTime: '城市時間', speed: '時間流速', weather: '天氣', atmosphere: '氣象',
    sun: '晴', rain: '雨', snow: '雪', sunLabel: '晴天', rainLabel: '雨天', snowLabel: '雪天',
    generation: '城市基因', generationLabel: '生成', seed: '地圖種子', random: '隨機產生城市',
    density: '建築密度', size: '羅盤尺寸', standard: '標準', large: '大型', vast: '廣域', generate: '產生城市',
    buildings: '建築', trees: '樹木', bridges: '橋樑', credit: '3D 素材：Kenney · CC0',
    viewControls: '視角控制', overhead: '俯視地圖', orbit: '旋轉視角', pan: '平移視角', zoomIn: '放大',
    zoomOut: '縮小', reset: '回到全景', autoOrbit: '自動環繞', export: '匯出城市圖片',
    loading2d: '繪製城市與街巷', loadingPlan: '規劃地形與航線', loadingModels: '載入城市模型',
    loadingTerrain: '建立山川與街巷', loadingLights: '準備夜景與光影', loadError: '城市載入失敗', retry: '重新載入',
    canvas3d: '可旋轉的三維城市', canvas2d: '可縮放和平移的城市地圖',
    bayTown: '海灣城鎮', riverValley: '曲流河谷', lakeside: '湖畔街區', islands: '島嶼聚落', cape: '岬角海岸', rivers: '交匯河網'
  },
  en: {
    language: 'Language', cityAtlas: 'City Atlas', model: 'Implementation model', switchModel: 'Switch implementation model',
    anotherCity: 'New city', settings: 'City settings', collapseSettings: 'Hide settings', closeSettings: 'Close settings',
    github: 'GitHub repository', githubTitle: 'View source on GitHub', notebook: 'City settings',
    now: 'Time', localTime: 'Local time', day: 'Day', night: 'Night', resume: 'Resume simulation', pause: 'Pause simulation',
    cityTime: 'City time', speed: 'Time speed', weather: 'Weather', atmosphere: 'Atmosphere',
    sun: 'Sun', rain: 'Rain', snow: 'Snow', sunLabel: 'Sunny', rainLabel: 'Rainy', snowLabel: 'Snowy',
    generation: 'City generation', generationLabel: 'Generation', seed: 'Map seed', random: 'Generate a random city',
    density: 'Building density', size: 'Map size', standard: 'Standard', large: 'Large', vast: 'Expansive', generate: 'Generate city',
    buildings: 'Buildings', trees: 'Trees', bridges: 'Bridges', credit: '3D assets by Kenney · CC0',
    viewControls: 'View controls', overhead: 'Top-down view', orbit: 'Rotate view', pan: 'Pan view', zoomIn: 'Zoom in',
    zoomOut: 'Zoom out', reset: 'Reset view', autoOrbit: 'Auto-rotate', export: 'Export city image',
    loading2d: 'Drawing the city', loadingPlan: 'Planning terrain and routes', loadingModels: 'Loading city models',
    loadingTerrain: 'Building terrain and streets', loadingLights: 'Preparing lights and shadows', loadError: 'Unable to load the city', retry: 'Try again',
    canvas3d: 'Rotatable 3D city', canvas2d: 'Zoomable and pannable city map',
    bayTown: 'Bay Town', riverValley: 'River Valley', lakeside: 'Lakeside', islands: 'Island Town', cape: 'Cape Coast', rivers: 'River Confluence'
  },
  ja: {
    language: '言語', cityAtlas: '都市マップ', model: '実装モデル', switchModel: '実装モデルを切り替え',
    anotherCity: '別の都市', settings: '都市の設定', collapseSettings: '設定を隠す', closeSettings: '設定を閉じる',
    github: 'GitHub リポジトリ', githubTitle: 'GitHub でソースを見る', notebook: '都市の設定',
    now: '時刻', localTime: '現地時刻', day: '昼', night: '夜', resume: 'シミュレーションを再開', pause: 'シミュレーションを一時停止',
    cityTime: '都市の時刻', speed: '時間の速さ', weather: '天気', atmosphere: '気象',
    sun: '晴れ', rain: '雨', snow: '雪', sunLabel: '晴天', rainLabel: '雨天', snowLabel: '雪天',
    generation: '都市の生成', generationLabel: '生成', seed: 'マップのシード', random: 'ランダムな都市を生成',
    density: '建物の密度', size: 'マップサイズ', standard: '標準', large: '大型', vast: '広域', generate: '都市を生成',
    buildings: '建物', trees: '樹木', bridges: '橋', credit: '3D 素材：Kenney · CC0',
    viewControls: '視点操作', overhead: '真上から見る', orbit: '視点を回転', pan: '視点を移動', zoomIn: '拡大',
    zoomOut: '縮小', reset: '全体表示に戻す', autoOrbit: '自動回転', export: '都市の画像を保存',
    loading2d: '都市を描画中', loadingPlan: '地形と航路を計画中', loadingModels: '都市モデルを読み込み中',
    loadingTerrain: '地形と街路を構築中', loadingLights: '光と影を準備中', loadError: '都市を読み込めませんでした', retry: '再試行',
    canvas3d: '回転可能な3D都市', canvas2d: '拡大と移動が可能な都市マップ',
    bayTown: '湾岸の街', riverValley: '蛇行する谷', lakeside: '湖畔の街', islands: '島々の集落', cape: '岬の海岸', rivers: '川の合流点'
  },
  ko: {
    language: '언어', cityAtlas: '도시 지도', model: '구현 모델', switchModel: '구현 모델 전환',
    anotherCity: '새 도시', settings: '도시 설정', collapseSettings: '설정 숨기기', closeSettings: '설정 닫기',
    github: 'GitHub 저장소', githubTitle: 'GitHub에서 소스 보기', notebook: '도시 설정',
    now: '시간', localTime: '현지 시간', day: '낮', night: '밤', resume: '시뮬레이션 재개', pause: '시뮬레이션 일시 정지',
    cityTime: '도시 시간', speed: '시간 속도', weather: '날씨', atmosphere: '기상',
    sun: '맑음', rain: '비', snow: '눈', sunLabel: '맑은 날씨', rainLabel: '비 오는 날씨', snowLabel: '눈 오는 날씨',
    generation: '도시 생성', generationLabel: '생성', seed: '지도 시드', random: '무작위 도시 생성',
    density: '건물 밀도', size: '지도 크기', standard: '표준', large: '대형', vast: '광역', generate: '도시 생성',
    buildings: '건물', trees: '나무', bridges: '다리', credit: '3D 에셋: Kenney · CC0',
    viewControls: '시점 제어', overhead: '위에서 보기', orbit: '시점 회전', pan: '시점 이동', zoomIn: '확대',
    zoomOut: '축소', reset: '전체 보기', autoOrbit: '자동 회전', export: '도시 이미지 저장',
    loading2d: '도시 그리는 중', loadingPlan: '지형과 항로 계획 중', loadingModels: '도시 모델 로딩 중',
    loadingTerrain: '지형과 거리 구성 중', loadingLights: '조명과 그림자 준비 중', loadError: '도시를 불러올 수 없습니다', retry: '다시 시도',
    canvas3d: '회전 가능한 3D 도시', canvas2d: '확대 및 이동 가능한 도시 지도',
    bayTown: '해안 도시', riverValley: '굽이치는 계곡', lakeside: '호숫가 마을', islands: '섬마을', cape: '곶 해안', rivers: '강의 합류점'
  },
  es: {
    language: 'Idioma', cityAtlas: 'Atlas urbano', model: 'Modelo de implementación', switchModel: 'Cambiar modelo de implementación',
    anotherCity: 'Otra ciudad', settings: 'Ajustes de ciudad', collapseSettings: 'Ocultar ajustes', closeSettings: 'Cerrar ajustes',
    github: 'Repositorio de GitHub', githubTitle: 'Ver código en GitHub', notebook: 'Ajustes de ciudad',
    now: 'Hora', localTime: 'Hora local', day: 'Día', night: 'Noche', resume: 'Reanudar simulación', pause: 'Pausar simulación',
    cityTime: 'Hora de la ciudad', speed: 'Velocidad del tiempo', weather: 'Clima', atmosphere: 'Atmósfera',
    sun: 'Sol', rain: 'Lluvia', snow: 'Nieve', sunLabel: 'Soleado', rainLabel: 'Lluvioso', snowLabel: 'Nevado',
    generation: 'Generación urbana', generationLabel: 'Generación', seed: 'Semilla del mapa', random: 'Generar ciudad aleatoria',
    density: 'Densidad de edificios', size: 'Tamaño del mapa', standard: 'Normal', large: 'Grande', vast: 'Extenso', generate: 'Generar ciudad',
    buildings: 'Edificios', trees: 'Árboles', bridges: 'Puentes', credit: 'Recursos 3D: Kenney · CC0',
    viewControls: 'Controles de vista', overhead: 'Vista cenital', orbit: 'Girar vista', pan: 'Desplazar vista', zoomIn: 'Acercar',
    zoomOut: 'Alejar', reset: 'Restablecer vista', autoOrbit: 'Giro automático', export: 'Exportar imagen de la ciudad',
    loading2d: 'Dibujando la ciudad', loadingPlan: 'Planificando terreno y rutas', loadingModels: 'Cargando modelos',
    loadingTerrain: 'Construyendo terreno y calles', loadingLights: 'Preparando luces y sombras', loadError: 'No se pudo cargar la ciudad', retry: 'Reintentar',
    canvas3d: 'Ciudad 3D giratoria', canvas2d: 'Mapa urbano con zoom y desplazamiento',
    bayTown: 'Ciudad Bahía', riverValley: 'Valle fluvial', lakeside: 'Junto al lago', islands: 'Villa insular', cape: 'Costa del cabo', rivers: 'Confluencia'
  },
  fr: {
    language: 'Langue', cityAtlas: 'Atlas urbain', model: 'Modèle de réalisation', switchModel: 'Changer de modèle',
    anotherCity: 'Autre ville', settings: 'Réglages de la ville', collapseSettings: 'Masquer les réglages', closeSettings: 'Fermer les réglages',
    github: 'Dépôt GitHub', githubTitle: 'Voir le code sur GitHub', notebook: 'Réglages de la ville',
    now: 'Heure', localTime: 'Heure locale', day: 'Jour', night: 'Nuit', resume: 'Reprendre la simulation', pause: 'Mettre en pause',
    cityTime: 'Heure de la ville', speed: 'Vitesse du temps', weather: 'Météo', atmosphere: 'Atmosphère',
    sun: 'Soleil', rain: 'Pluie', snow: 'Neige', sunLabel: 'Ensoleillé', rainLabel: 'Pluvieux', snowLabel: 'Neigeux',
    generation: 'Création de ville', generationLabel: 'Génération', seed: 'Graine de la carte', random: 'Créer une ville aléatoire',
    density: 'Densité des bâtiments', size: 'Taille de la carte', standard: 'Normale', large: 'Grande', vast: 'Étendue', generate: 'Créer la ville',
    buildings: 'Bâtiments', trees: 'Arbres', bridges: 'Ponts', credit: 'Modèles 3D : Kenney · CC0',
    viewControls: 'Contrôles de vue', overhead: 'Vue du dessus', orbit: 'Tourner la vue', pan: 'Déplacer la vue', zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière', reset: 'Réinitialiser la vue', autoOrbit: 'Rotation automatique', export: 'Exporter une image de la ville',
    loading2d: 'Dessin de la ville', loadingPlan: 'Planification du terrain et des routes', loadingModels: 'Chargement des modèles',
    loadingTerrain: 'Construction du terrain et des rues', loadingLights: 'Préparation des ombres et lumières', loadError: 'Impossible de charger la ville', retry: 'Réessayer',
    canvas3d: 'Ville 3D orientable', canvas2d: 'Carte urbaine avec zoom et déplacement',
    bayTown: 'Ville de baie', riverValley: 'Vallée fluviale', lakeside: 'Ville du lac', islands: 'Ville insulaire', cape: 'Côte du cap', rivers: 'Confluence'
  },
  de: {
    language: 'Sprache', cityAtlas: 'Stadtatlas', model: 'Umsetzungsmodell', switchModel: 'Umsetzungsmodell wechseln',
    anotherCity: 'Neue Stadt', settings: 'Stadteinstellungen', collapseSettings: 'Einstellungen ausblenden', closeSettings: 'Einstellungen schließen',
    github: 'GitHub-Repository', githubTitle: 'Quellcode auf GitHub ansehen', notebook: 'Stadteinstellungen',
    now: 'Zeit', localTime: 'Ortszeit', day: 'Tag', night: 'Nacht', resume: 'Simulation fortsetzen', pause: 'Simulation pausieren',
    cityTime: 'Stadtzeit', speed: 'Zeittempo', weather: 'Wetter', atmosphere: 'Atmosphäre',
    sun: 'Sonne', rain: 'Regen', snow: 'Schnee', sunLabel: 'Sonnig', rainLabel: 'Regnerisch', snowLabel: 'Schneefall',
    generation: 'Stadterstellung', generationLabel: 'Erstellung', seed: 'Karten-Seed', random: 'Zufällige Stadt erstellen',
    density: 'Bebauungsdichte', size: 'Kartengröße', standard: 'Standard', large: 'Groß', vast: 'Weitläufig', generate: 'Stadt erstellen',
    buildings: 'Gebäude', trees: 'Bäume', bridges: 'Brücken', credit: '3D-Modelle: Kenney · CC0',
    viewControls: 'Ansicht steuern', overhead: 'Draufsicht', orbit: 'Ansicht drehen', pan: 'Ansicht verschieben', zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern', reset: 'Ansicht zurücksetzen', autoOrbit: 'Automatisch drehen', export: 'Stadtbild exportieren',
    loading2d: 'Stadt wird gezeichnet', loadingPlan: 'Gelände und Routen werden geplant', loadingModels: 'Stadtmodelle werden geladen',
    loadingTerrain: 'Gelände und Straßen werden erstellt', loadingLights: 'Licht und Schatten werden vorbereitet', loadError: 'Stadt konnte nicht geladen werden', retry: 'Erneut versuchen',
    canvas3d: 'Drehbare 3D-Stadt', canvas2d: 'Stadtkarte mit Zoom und Verschiebung',
    bayTown: 'Buchtstadt', riverValley: 'Flusstal', lakeside: 'Seestadt', islands: 'Inselstadt', cape: 'Kapstadt', rivers: 'Flussnetz'
  },
  pt: {
    language: 'Idioma', cityAtlas: 'Atlas urbano', model: 'Modelo de implementação', switchModel: 'Trocar modelo de implementação',
    anotherCity: 'Outra cidade', settings: 'Configurações da cidade', collapseSettings: 'Ocultar configurações', closeSettings: 'Fechar configurações',
    github: 'Repositório GitHub', githubTitle: 'Ver código no GitHub', notebook: 'Configurações da cidade',
    now: 'Hora', localTime: 'Hora local', day: 'Dia', night: 'Noite', resume: 'Retomar simulação', pause: 'Pausar simulação',
    cityTime: 'Hora da cidade', speed: 'Velocidade do tempo', weather: 'Clima', atmosphere: 'Atmosfera',
    sun: 'Sol', rain: 'Chuva', snow: 'Neve', sunLabel: 'Ensolarado', rainLabel: 'Chuvoso', snowLabel: 'Nevando',
    generation: 'Geração da cidade', generationLabel: 'Geração', seed: 'Semente do mapa', random: 'Gerar cidade aleatória',
    density: 'Densidade de prédios', size: 'Tamanho do mapa', standard: 'Padrão', large: 'Grande', vast: 'Amplo', generate: 'Gerar cidade',
    buildings: 'Prédios', trees: 'Árvores', bridges: 'Pontes', credit: 'Recursos 3D: Kenney · CC0',
    viewControls: 'Controles de visualização', overhead: 'Vista de cima', orbit: 'Girar vista', pan: 'Mover vista', zoomIn: 'Ampliar',
    zoomOut: 'Reduzir', reset: 'Redefinir vista', autoOrbit: 'Rotação automática', export: 'Exportar imagem da cidade',
    loading2d: 'Desenhando a cidade', loadingPlan: 'Planejando terreno e rotas', loadingModels: 'Carregando modelos',
    loadingTerrain: 'Construindo terreno e ruas', loadingLights: 'Preparando luzes e sombras', loadError: 'Não foi possível carregar a cidade', retry: 'Tentar novamente',
    canvas3d: 'Cidade 3D com rotação', canvas2d: 'Mapa urbano com zoom e movimento',
    bayTown: 'Cidade da baía', riverValley: 'Vale fluvial', lakeside: 'Cidade do lago', islands: 'Vila insular', cape: 'Costa do cabo', rivers: 'Confluência'
  },
  ru: {
    language: 'Язык', cityAtlas: 'Атлас города', model: 'Модель реализации', switchModel: 'Сменить модель реализации',
    anotherCity: 'Другой город', settings: 'Настройки города', collapseSettings: 'Скрыть настройки', closeSettings: 'Закрыть настройки',
    github: 'Репозиторий GitHub', githubTitle: 'Исходный код на GitHub', notebook: 'Настройки города',
    now: 'Время', localTime: 'Местное время', day: 'День', night: 'Ночь', resume: 'Продолжить симуляцию', pause: 'Приостановить симуляцию',
    cityTime: 'Время в городе', speed: 'Скорость времени', weather: 'Погода', atmosphere: 'Атмосфера',
    sun: 'Солнце', rain: 'Дождь', snow: 'Снег', sunLabel: 'Солнечно', rainLabel: 'Дождливо', snowLabel: 'Снегопад',
    generation: 'Создание города', generationLabel: 'Генерация', seed: 'Зерно карты', random: 'Создать случайный город',
    density: 'Плотность застройки', size: 'Размер карты', standard: 'Обычный', large: 'Большой', vast: 'Обширный', generate: 'Создать город',
    buildings: 'Здания', trees: 'Деревья', bridges: 'Мосты', credit: '3D-модели: Kenney · CC0',
    viewControls: 'Управление видом', overhead: 'Вид сверху', orbit: 'Повернуть вид', pan: 'Переместить вид', zoomIn: 'Приблизить',
    zoomOut: 'Отдалить', reset: 'Сбросить вид', autoOrbit: 'Автовращение', export: 'Сохранить изображение города',
    loading2d: 'Отрисовка города', loadingPlan: 'Планирование рельефа и маршрутов', loadingModels: 'Загрузка моделей города',
    loadingTerrain: 'Создание рельефа и улиц', loadingLights: 'Подготовка света и теней', loadError: 'Не удалось загрузить город', retry: 'Повторить',
    canvas3d: 'Трёхмерный город с вращением', canvas2d: 'Карта города с масштабированием и перемещением',
    bayTown: 'Город у залива', riverValley: 'Речная долина', lakeside: 'Город у озера', islands: 'Островной город', cape: 'Берег мыса', rivers: 'Слияние рек'
  }
}

export function normalizeLocale(value) {
  try {
    const locale = new Intl.Locale(value)
    if (locale.language === 'zh') {
      return locale.maximize().script === 'Hant' ? 'zh-TW' : 'zh-CN'
    }
    return LANGUAGES.some(([id]) => id === locale.language) ? locale.language : null
  } catch {
    return null
  }
}

export function getInitialLocale() {
  try {
    const saved = normalizeLocale(localStorage.getItem(LANGUAGE_KEY))
    if (saved) return saved
  } catch { /* Storage may be disabled in private browsing. */ }
  return (navigator.languages || [navigator.language]).map(normalizeLocale).find(Boolean) || 'en'
}

const terrainKeys = {
  '海湾城镇': 'bayTown', '曲流河谷': 'riverValley', '湖畔街区': 'lakeside',
  '岛屿聚落': 'islands', '岬角海岸': 'cape', '交汇河网': 'rivers'
}
export function cityNameFor(locale, terrainName) {
  return messages[locale][terrainKeys[terrainName] || 'cityAtlas']
}
