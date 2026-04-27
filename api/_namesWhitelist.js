// Whitelist de nombres comunes en español (España + LATAM).
// 250 masculinos + 250 femeninos. Si el userName no coincide con esta lista,
// la meditación se genera sin nombre (genérico) en lugar de pronunciar basura.
//
// Comparación: lowercase + sin acentos + primera palabra del input
// (ej: "Juan Carlos" → check "juan" → match).
//
// Fuentes: INE España (top 100 frecuentes), datos demográficos LATAM
// (México INEGI, Chile RC, Argentina ANSES), diminutivos comunes.

const MALE_NAMES = [
  // Top 50 España + LATAM
  'jose','antonio','manuel','francisco','juan','david','daniel','jesus','javier','carlos',
  'miguel','pedro','angel','rafael','alejandro','luis','alberto','sergio','jorge','fernando',
  'pablo','enrique','ramon','vicente','andres','diego','adrian','raul','ivan','ruben',
  'mario','oscar','victor','eduardo','roberto','jaime','julio','salvador','marcos','alfonso',
  'tomas','ricardo','santiago','agustin','julian','ignacio','cesar','santos','felix','marc',
  // 50-100
  'mateo','nicolas','sebastian','martin','lucas','samuel','hugo','leo','joel','izan',
  'gonzalo','aaron','enzo','dario','axel','bruno','marcelo','cristian','alex','aitor',
  'gabriel','miguel angel','rodrigo','emiliano','matias','benjamin','tomas','joaquin','isaac','alvaro',
  'cristobal','franco','simon','vicente','agustin','baltazar','dante','gael','ian','liam',
  'maximiliano','santino','thiago','valentin','benicio','bautista','noah','nil','pol','arnau',
  // 100-150
  'ezequiel','alan','adam','aldo','amir','amilcar','anibal','aristides','arnaldo','aurelio',
  'baltasar','bartolome','basilio','bautista','benito','benjamin','bernardo','blas','borja','braulio',
  'calixto','camilo','candido','carmelo','casimiro','cayetano','cesar','cipriano','claudio','clemente',
  'conrado','constantino','crispulo','damian','demetrio','desiderio','domingo','donato','edgar','edmundo',
  'efrain','elias','eligio','eliodoro','eloy','emilio','emiliano','epifanio','erasmo','erick',
  // 150-200
  'esteban','eugenio','eusebio','evaristo','ezequiel','fabian','fabio','fausto','felipe','feliciano',
  'fermin','fidel','filiberto','flavio','florencio','florentino','francisco javier','frutos','gaspar','genaro',
  'gerardo','german','gilberto','gines','godofredo','goyo','gregorio','guillermo','gustavo','hector',
  'heriberto','herman','hernan','hilario','hipolito','homero','horacio','humberto','ildefonso','iker',
  'isidoro','isidro','ismael','israel','jacinto','jacobo','jairo','jeremias','jeronimo','jesus',
  // 200-250
  'jonas','jonathan','josue','juancarlos','juanjo','juanma','juanpa','juanpablo','justo','lautaro',
  'lazaro','leandro','leonardo','leonel','leoncio','leopoldo','lino','lorenzo','luciano','lucio',
  'luismi','macario','manolo','marciano','marcial','marciano','mariano','marino','mauricio','maximo',
  'melchor','melquiades','milton','modesto','moises','nahuel','natalio','nelson','nemesio','neptali',
  'nestor','nicanor','noe','noel','norberto','octavio','olegario','omar','onesimo','orestes',
  'orlando','osvaldo','otoniel','pancracio','pascual','patricio','paco','pepe','pepito','perfecto',
  'placido','plinio','porfirio','procopio','quintin','quique','rafa','ramiro','reinaldo','remigio',
  'renato','rene','reyes','rigoberto','rocco','rodolfo','rogelio','rogerio','rolando','roman',
  'romualdo','roque','rosendo','rufino','salvador','salomon','sandalio','saul','segismundo','segundo',
  'severino','severo','sigfrido','silvestre','silvino','silvio','sixto','tadeo','telmo','teo',
  'teodoro','teofilo','tiago','tiburcio','timoteo','toni','tony','toribio','tristan','ubaldo',
  'ulises','urbano','valentin','valeriano','valerio','venancio','victorino','vidal','virgilio','wenceslao',
  'wifredo','wilfrido','william','willy','xabier','xavier','yago','yeray','yuri','zacarias',
  'zenon','zoilo','adriano','aitana','alaitz','alaitz','alaric','aleix','aleix','alfredo'
];

const FEMALE_NAMES = [
  // Top 50 España (INE)
  'maria','carmen','ana','isabel','dolores','laura','pilar','cristina','lucia','paula',
  'marta','sara','elena','rosa','antonia','francisca','manuela','rocio','andrea','beatriz',
  'angela','silvia','mercedes','sandra','julia','irene','patricia','raquel','monica','alba',
  'eva','susana','rosario','sonia','natalia','margarita','encarnacion','consuelo','victoria','esther',
  'concepcion','teresa','gloria','marina','nuria','noelia','yolanda','olga','catalina','milagros',
  // 50-100
  'sofia','daniela','valentina','valeria','camila','fernanda','gabriela','isabella','luna','emma',
  'mia','victoria','lara','ariadna','mar','olivia','vega','lola','triana','aitana',
  'carla','claudia','blanca','jimena','clara','ines','adriana','noa','aurora','bella',
  'celia','candela','julieta','martina','renata','salome','antonella','emilia','paulina','regina',
  'romina','agustina','constanza','florencia','aurora','mateo','nicole','michelle','maite','ximena',
  // 100-150
  'abril','adela','adelaida','adelina','agata','agueda','aida','alejandra','alessandra','alexia',
  'alicia','almudena','amalia','amanda','amaya','amelia','amparo','anabel','anaclara','anamaria',
  'anastasia','araceli','arancha','arantxa','arely','ariana','aroa','asuncion','aurelia','azucena',
  'barbara','begoña','belen','belinda','berenice','bertha','brianda','brigida','briseida','brunilda',
  'caridad','carlota','carmela','carmenza','carolina','casandra','cati','cayetana','cecilia','celeste',
  // 150-200
  'celinda','chabela','chela','chelo','chiara','chloe','cinthia','cintia','claribel','clarisa',
  'clemencia','clementina','cloe','concha','conchi','conchita','coral','corina','cynthia','dafne',
  'daiana','dalia','damaris','dana','danitza','daria','debora','delfina','delia','denise',
  'diana','domenica','dominga','dora','doris','dulce','edelmira','edith','elba','eli',
  'eliana','elisa','elisabet','elisabeth','elizabeth','eloina','elsa','elvira','emelina','encarna',
  // 200-250
  'engracia','enriqueta','erica','erika','ernestina','esmeralda','esperanza','estefania','estela','estefana',
  'estrella','etelvina','eufemia','eugenia','eulalia','evangelina','evelin','evelina','evelyn','fabiana',
  'fanny','fatima','felicidad','felipa','felisa','fermina','fidelia','filomena','flavia','flora',
  'florentina','florinda','francesca','gala','galia','gemma','genoveva','georgina','geraldina','gertrudis',
  'gimena','gina','gisela','gisele','giselle','gladys','goretti','graciela','greta','gretel',
  'guadalupe','guillermina','haydee','helena','heloisa','herminia','hilaria','hilda','hortensia','idoia',
  'idolia','ileana','indira','iratxe','iria','iris','irma','isadora','isaura','isidora',
  'itziar','iva','ivana','ivone','jacinta','jacqueline','jania','janira','jasmin','jazmin',
  'jenifer','jennifer','jesica','jessica','jezabel','joaquina','jocelyn','jordana','josefa','josefina',
  'josephine','josune','joyce','juana','juanita','judith','juliana','justa','karina','karla',
  'kassandra','katherine','kelly','kiara','laia','leyre','liana','lidia','liliana','lina',
  'liz','lorena','loreto','lourdes','lucila','luna','luz','macarena','magdalena','magnolia',
  'maite','malena','manuela','maribel','maricarmen','marisa','marisol','maritere','maritza','marlene',
  'matilde','maxima','melania','melisa','melissa','meritxell','micaela','michelle','milena','minerva',
  'mireia','miriam','modesta','myriam','nadia','nahir','nalleli','nancy','nayeli','nidia',
  'nina','noa','noelia','noemi','nora','norma','nuria','obdulia','octavia','onelia',
  'paloma','pamela','paqui','pascuala','pastora','paulina','paz','perla','petra','pia',
  'priscila','prudencia','rebeca','reina','reyes','rita','roberta','romina','rosalia','rosalinda',
  'rosario','rosaura','rosenda','roxana','rubi','ruth','sagrario','salud','samanta','samantha'
];

const ALL_NAMES = new Set([...MALE_NAMES, ...FEMALE_NAMES]);

function _normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ñ/g, 'n')
    .trim();
}

/**
 * Decide si un userName es seguro de inyectar en el prompt.
 * Compara la primera palabra del input contra la whitelist (sin acentos, lowercase).
 * Si NO matchea, devuelve string vacío → el prompt no usa nombre.
 */
function validateUserName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Solo letras + espacios + acentos + apóstrofes/guiones de apellidos
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜüÀÈÌÒÙàèìòù\s'-]+$/.test(trimmed)) return '';

  // Tomar primera palabra (Juan Carlos → "juan", María José → "maría")
  const firstWord = trimmed.split(/\s+/)[0];
  const normalized = _normalize(firstWord);

  if (normalized.length < 2 || normalized.length > 25) return '';
  if (!ALL_NAMES.has(normalized)) return '';

  return trimmed.slice(0, 50);
}

module.exports = { validateUserName, MALE_NAMES, FEMALE_NAMES };
