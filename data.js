const DISTRIBUIDORES = [
  { cuit: "33711316839", razonSocial: "1 DE ABRIL S.A.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30502874353", razonSocial: "ACEITERA GENERAL DEHEZA S.A.", bu: "Centro", squad: "Centro" },
  { cuit: "30710150520", razonSocial: "AGL S.A.", bu: "Norte", squad: "NEA" },
  { cuit: "30707855602", razonSocial: "AGRO ARROYO INSUMOS S.R.L.", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30707181814", razonSocial: "AGRO BUEY INSUMOS S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "30708920130", razonSocial: "AGRO GESTION DEL LITORAL S.A.", bu: "Norte", squad: "ESTE" },
  { cuit: "30714064319", razonSocial: "AGRO LEBEN JUNIN S.R.L.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "33711669979", razonSocial: "AGRO NOBLE S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "30668239559", razonSocial: "AGRO SERVICIOS S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "30638888811", razonSocial: "AGRO UCACHA S.R.L.", bu: "Centro", squad: "RIO IV & S. LUIS" },
  { cuit: "30711373019", razonSocial: "AGROLATINA S.R.L.", bu: "Norte", squad: "NEA" },
  { cuit: "30711295646", razonSocial: "AGRO-LEBEN S.R.L.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30710618433", razonSocial: "AGRONOMIA BAUDINO S.A.", bu: "Sur", squad: "Oeste" },
  { cuit: "30708968338", razonSocial: "AGRONOMIA DOM S.A.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30717074757", razonSocial: "AGRONOMIA LINDON SRL", bu: "Sur", squad: "Sur" },
  { cuit: "30708362235", razonSocial: "AGROQUIMICOS DEL NORTE S.A.", bu: "Norte", squad: "NEA" },
  { cuit: "30626586186", razonSocial: "AGROQUIMICOS DEL SUR S.R.L.", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30711292418", razonSocial: "AGROSISTEMA MAR CHIQUITA S.R.L.", bu: "Centro", squad: "Centro" },
  { cuit: "30717314111", razonSocial: "AGROSOLUCIONES DERO SA", bu: "Sur", squad: "Oeste" },
  { cuit: "30711202206", razonSocial: "AGROSURCO SOLUCIONES S.R.L.", bu: "Norte", squad: "NEA" },
  { cuit: "30617849212", razonSocial: "AIBAL SERVICIOS AGROPECUARIOS S.A.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30673096723", razonSocial: "AJU S.R.L.", bu: "Norte", squad: "NOA" },
  { cuit: "30572066114", razonSocial: "ALBERTO MONCHO E HIJOS S.A.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30710880723", razonSocial: "ALESSO AGRO S.A.", bu: "Norte", squad: "ESTE" },
  { cuit: "30711356742", razonSocial: "ALLEGRO S.A.", bu: "Norte", squad: "ESTE" },
  { cuit: "30644215640", razonSocial: "ARROYO VIEJO S.R.L.", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30711552924", razonSocial: "BARRACON S.R.L.", bu: "Norte", squad: "NOA" },
  { cuit: "30707149864", razonSocial: "BESANA SEMILLAS S.R.L.", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "33710914139", razonSocial: "BIOTERRA S.A.", bu: "Sur", squad: "Sur" },
  { cuit: "20201433178", razonSocial: "BOUVIER GUILLERMO LUJAN", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30595337441", razonSocial: "CARLOS E ITURRIAGA E HIJOS S.A.", bu: "Sur", squad: "Sur" },
  { cuit: "33581249549", razonSocial: "CEREALES QUEMU S.A.", bu: "Sur", squad: "Oeste" },
  { cuit: "30711533504", razonSocial: "CORRAL INSUMOS S.A.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "33709478449", razonSocial: "CROP TALENT S.A.", bu: "Sur", squad: "Oeste" },
  { cuit: "30715511394", razonSocial: "CYAGRO S.A.", bu: "Sur", squad: "Oeste" },
  { cuit: "30713966807", razonSocial: "DEKALDEN S.R.L.", bu: "Sur", squad: "Oeste" },
  { cuit: "30712455779", razonSocial: "DEKANOR S.R.L.", bu: "Norte", squad: "NEA" },
  { cuit: "30707199462", razonSocial: "DEL SUR MARCOS JUAREZ S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "30708123982", razonSocial: "DELYAR S.A.", bu: "Centro", squad: "Centro" },
  { cuit: "30714929069", razonSocial: "DI CROCE Y LOZANO S.R.L.", bu: "Sur", squad: "Sur" },
  { cuit: "30707494006", razonSocial: "DOS CACIQUES S.R.L.", bu: "Sur", squad: "Sur" },
  { cuit: "30547090523", razonSocial: "EDUARDO BERAZA S.A.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30714485713", razonSocial: "EKUN AGRO S.R.L.", bu: "Sur", squad: "Oeste" },
  { cuit: "30710473826", razonSocial: "EL LADERO S.A.", bu: "Centro", squad: "Centro" },
  { cuit: "33711755069", razonSocial: "EL MALACATE S.A.", bu: "Norte", squad: "ESTE" },
  { cuit: "30710414838", razonSocial: "EL MALAMBO AGROPECUARIA S.A.", bu: "Sur", squad: "Oeste" },
  { cuit: "30714690279", razonSocial: "EL PAYE INSUMOS Y SERVICIOS S.A.", bu: "Sur", squad: "Oeste" },
  { cuit: "33634731089", razonSocial: "EMPRESA DE TRABAJOS TECNICO AGROPECUARIOS S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "30710844778", razonSocial: "FOCSEED S.A.", bu: "Centro", squad: "RIO IV & S. LUIS" },
  { cuit: "30708742798", razonSocial: "FULLAGRO S.R.L.", bu: "Sur", squad: "Oeste" },
  { cuit: "30571702246", razonSocial: "FUMISEM S.A.", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30709089923", razonSocial: "GRANOS DEL PLATA SRL", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30708696648", razonSocial: "GRUPO SAV ARGENTINA S.A.", bu: "Norte", squad: "ESTE" },
  { cuit: "30653461433", razonSocial: "INTEGRAL AGROPECUARIA S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "33674838609", razonSocial: "LA CLEMENTINA S.A.", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30714691437", razonSocial: "LA NUEVA AGROPULSO S.R.L.", bu: "Sur", squad: "Oeste" },
  { cuit: "30707153160", razonSocial: "LANGELLOTTI S.R.L.", bu: "Norte", squad: "NEA" },
  { cuit: "30678678372", razonSocial: "MIRU AGROPECUARIA S.R.L.", bu: "Centro", squad: "Centro" },
  { cuit: "30709440310", razonSocial: "NUEVA HUELLA S.R.L.", bu: "Sur", squad: "Sur" },
  { cuit: "30708309768", razonSocial: "PASAGRO S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "30707003053", razonSocial: "R Y K S.R.L.", bu: "Norte", squad: "NEA" },
  { cuit: "27118436879", razonSocial: "RECARI MARIA FRANCISCA", bu: "Sur", squad: "Sur" },
  { cuit: "30707523057", razonSocial: "SAC S.A.", bu: "Centro", squad: "Centro" },
  { cuit: "30708997354", razonSocial: "SANCHEZ AGRONEGOCIOS S.A.", bu: "Centro", squad: "RIO IV & S. LUIS" },
  { cuit: "30710042787", razonSocial: "SERAGRO S.A.", bu: "Centro", squad: "RIO IV & S. LUIS" },
  { cuit: "30697218056", razonSocial: "SINER S.A", bu: "Norte", squad: "NOA" },
  { cuit: "30709011762", razonSocial: "TECNOSUR S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "30708276215", razonSocial: "TERRA MAS S.R.L.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30710268998", razonSocial: "TERRA SALTO S.R.L.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30710413653", razonSocial: "TIERRA SUR S.R.L.", bu: "Centro", squad: "Córdoba Este" },
  { cuit: "30668764300", razonSocial: "TODO CAMPO S.R.L.", bu: "Centro", squad: "RIO IV & S. LUIS" },
  { cuit: "30711724717", razonSocial: "TRES ROBLES S.R.L.", bu: "Norte", squad: "ESTE" },
  { cuit: "30685721763", razonSocial: "TUCAGRO S.R.L.", bu: "Norte", squad: "NOA" },
  { cuit: "20120024583", razonSocial: "URRUTI GUILLERMO C HIJO", bu: "Sur", squad: "Sur" },
  { cuit: "30715469290", razonSocial: "VERDE SIEMBRA S.A.", bu: "Sur", squad: "Núcleo Sur" },
  { cuit: "30709476676", razonSocial: "ZANOY AGRO & SERVICIOS SOCIEDAD ANONIMA", bu: "Centro", squad: "Centro" },
  { cuit: "30707489851", razonSocial: "AGROPECUARIA DEL PARANA S.A.", bu: "Norte", squad: "NEA" },
  { cuit: "30715118358", razonSocial: "PAREJO AGRO (LAS MARTINAS)", bu: "Centro", squad: "RIO IV & S. LUIS" },
  { cuit: "30718916115", razonSocial: "CRUZCAMPO AGRONEGOCIOS SA", bu: "Sur", squad: "Oeste" },
  { cuit: "30717345769", razonSocial: "MAINET SRL", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30718501233", razonSocial: "BONAMICO AGUIRRE SAS", bu: "Sur", squad: "Núcleo Norte" },
  { cuit: "30719281946", razonSocial: "ANBAU SUDESTE SA", bu: "Sur", squad: "Sur" }
];

const ASSESSMENT_DATA = {
  categories: [
    {
      id: 1,
      key: "vision_estrategica",
      name: "Visión Estratégica/Gerencial",
      weightTotal: 0.20,
      questions: [
        {
          id: "1.1",
          aspecto: "Plan estratégico",
          pregunta: "¿Cómo ve el crecimiento de la empresa en los próximos 5 años?\n¿El distribuidor tiene un plan de inversión y crecimiento para el corto, mediano y largo plazo?\n¿Hay un plan claro para el desarrollo y crecimiento?\n¿Hay objetivos y retos definidos para garantizar el cumplimento del objetivo?",
          bajo: {
            titulo: "No existe un plan de inversión general del distribuidor",
            detalles: [
              "El distribuidor no tiene un número claro de crecimiento para este año",
              "Da respuestas vagas acerca del plan de inversiones y a la visión de la empresa en 5 años",
              "El distribuidor opera de manera reactiva"
            ]
          },
          mediano: {
            titulo: "Hay un plan estratégico pero sin mucha claridad de objetivos y retos",
            detalles: [
              "El distribuidor puede responder el crecimiento para el año actual y relatar el plan de inversiones de manera satisfactoria",
              "El distribuidor no tiene una actitud proactiva para promover el crecimiento de los números",
              "Para los próximos años no muestra claridad sobre el plan"
            ]
          },
          alto: {
            titulo: "Plan concreto de crecimiento y mejora de indicadores generales",
            detalles: [
              "Considera un incremento de MS de sus productos",
              "Tiene claridad de retos que se pueden presentar en futuro y como atacarlos",
              "Claridad sobre inversiones que quiere realizar",
              "Tiene alineación con Bayer sobre los retos y objetivos internos del distribuidor"
            ]
          },
          ponderacionCompetencia: 0.15,
          ponderacionTotal: 0.03
        },
        {
          id: "1.2",
          aspecto: "Planificación de ventas",
          pregunta: "¿Existe un proceso formal de planificación de ventas por parte del distribuidor?\n¿Hay un proceso de revisión del plan de negocios con los proveedores?\n¿El distribuidor cuenta con objetivos propios del plan de ventas?",
          bajo: {
            titulo: "No hacen una planeación de ventas",
            detalles: [
              "No hay un proceso de planeación de ventas con los proveedores",
              "El distribuidor no tiene metas de ventas, objetivos para cumplimento en cada categoría de producto",
              "El distribuidor esta preocupado solamente en garantizar \"el mínimo\" para las ventas"
            ]
          },
          mediano: {
            titulo: "Existe una planeación de ventas pero no es estructurada",
            detalles: [
              "Hay un proceso de planeación de ventas pero no hay una revisión periódica de los objetivos",
              "La planeación de las ventas están alineadas con el histórico de las ventas y no con el potencial futuro de crecimiento de la zona"
            ]
          },
          alto: {
            titulo: "Hay un proceso formal de planeación de las ventas, con revisión y metas claras",
            detalles: [
              "El distribuidor tiene metas de ventas por proveedor e tiene una buena alineación con todos",
              "La planeación de ventas es revisada de forma periódica con enfoque en garantizar cualquier ajuste necesario",
              "Los objetivos son planeados de acuerdo con el pasado pero también con el potencial de la zona hacia el futuro"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "1.3",
          aspecto: "Apertura de crecimiento con Bayer",
          pregunta: "¿Qué piensas sobre la relación junto a Bayer?\n¿Qué tanto Bayer es relevante para la facturación del distribuidor?\n¿Tiene interés para crecer con Bayer?\n¿Hay inversiones o cambios recientes del distribuidor para acompañar y crecer con Bayer?",
          bajo: {
            titulo: "No está alineado con las ambiciones de Bayer",
            detalles: [
              "Cuando Bayer solicita ajustes o cambios el distribuidor no los realiza de manera ágil o no los realiza",
              "No muestra interés de crecer negocio de Bayer",
              "No hace muchas inversiones en la operación para acompañar el crecimiento con Bayer"
            ]
          },
          mediano: {
            titulo: "Está dispuesto a trabajar con algunas ambiciones de Bayer",
            detalles: [
              "Cuando Bayer solicita ajustes o cambios el distribuidor los realiza a su tiempo y si le son convenientes",
              "Muestra interés de crecer negocio de Bayer",
              "No tienen mucha velocidad para la implementación de los cambios",
              "Hace algunos cambios pero no es proactivo en sus acciones para acompañar a Bayer"
            ]
          },
          alto: {
            titulo: "Está bastante alineado con los planes de Bayer y siempre mantiene un contacto cercano",
            detalles: [
              "Cuando Bayer solicita ajustes o cambios el distribuidor los realiza de manera ágil",
              "Muestra mucho interés en crecer el negocio de Bayer y se alinea con la manera de trabajo de Bayer",
              "Tienen mucha velocidad y agilidad para los cambios",
              "Son proactivos con acciones para promover el crecimiento de la facturación"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "1.4",
          aspecto: "Plan de sucesión",
          pregunta: "¿El distribuidor tiene un plan de sucesión claro y definido?\n¿Consideran que dentro de los próximos 5 años ocurrirán cambios a nivel gerencial?\n¿Los sucesores de los propietarios son personas de confianza, ya están en el negocio o se están formando para poder hacerse cargo de la gestión en el futuro?",
          bajo: {
            titulo: "No hay plan de sucesión definido",
            detalles: [
              "No hay planes claros sobre cómo ocurrirá esto (por ejemplo, propietario mayor sin hijos identificados para la sucesión)",
              "Hay potenciales cambios en la dirección del distribuidor para los próximos años y no hay planes de reemplazo"
            ]
          },
          mediano: {
            titulo: "Hay un plan de sucesión, pero poco previsto",
            detalles: [
              "La empresa tiene claro quién debe hacerse cargo de la operación en el futuro, pero no están siendo capacitados para la función"
            ]
          },
          alto: {
            titulo: "Existe un plan de sucesión bien planificado",
            detalles: [
              "Se tiene claro que pasará en caso de un cambio previsto o imprevisto de la dirección de la empresa en los próximos años",
              "Se cuenta con el equipo capacitado para hacer las tareas que involucra el día a día para ejecutar el plan"
            ]
          },
          ponderacionCompetencia: 0.20,
          ponderacionTotal: 0.04
        },
        {
          id: "1.5",
          aspecto: "Involucramiento del dueño en la operación",
          pregunta: "¿Cuál es el grado de involucramiento del dueño en la operación del distribuidor?\n¿Participa del día a día del negocio?\n¿Está involucrado en la toma de decisiones y definición de estrategias?",
          bajo: {
            titulo: "Totalmente desligado a la operación y planificación del negocio",
            detalles: [
              "No se encuentra en contacto constante con su equipo",
              "No conoce el portafolio de clientes que atiende",
              "No tiene foco en el día a día de ejecución",
              "El negocio de distribución de Bayer es poco prioritario para el dueño"
            ]
          },
          mediano: {
            titulo: "Sólo conoce la operación por medio de los reportes gerenciales",
            detalles: [
              "Se presenta a las sesiones de resultados únicamente",
              "Conoce sobre grandes proyectos e inversiones únicamente",
              "Tiene peso el negocio de distribución de Bayer para el dueño",
              "El dueño conoce la operación pero no esta 100% involucrado por razones distintas (ej. esta a frente de otra operación o distribuidor)"
            ]
          },
          alto: {
            titulo: "Liderazgo altamente involucrado en el negocio y día a día",
            detalles: [
              "El dueño está involucrado en la gestión del negocio y tiene una relación larga con Bayer",
              "La distribución de Bayer es uno de sus negocios principales, si no es que el único",
              "Se mantiene presente y activo en la relación",
              "El dueño no esta a frente de ninguna otra operación o distribuidor"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "1.6",
          aspecto: "Autodesarrollo del dueño",
          pregunta: "¿El dueño invierte en su autodesarrollo?\n¿El dueño tiene perfil de gestión de negocial / perfil emprendedor?\n¿Ha tenido capacitaciones o cursos recientemente sobre el agronegocio?\n¿El dueño tiene expertos sobre el agronegocio, productos y mercado?",
          bajo: {
            titulo: "Dueño con pocos conocimientos o experiencia en el sector, que toma decisiones sin análisis o basadas en la intuición",
            detalles: [
              "No invierte tiempo ni recursos en su propio desarrollo profesional ni en la capacitación continua",
              "La toma de decisiones se basa más en la intuición o en la experiencia pasada, sin un análisis adecuado de los datos o las tendencias del mercado"
            ]
          },
          mediano: {
            titulo: "Dueño tiene un conocimiento básico del sector y hace esfuerzos por mantenerse actualizado",
            detalles: [
              "Invierte en su autodesarrollo realizando cursos esporádicos (al menos uno dentro de los últimos 5 años)",
              "Tiene cierta experiencia en el sector, pero aún le falta profundidad en áreas clave como la gestión estratégica, la tecnología o la innovación"
            ]
          },
          alto: {
            titulo: "Dueño tiene una experiencia sólida y profunda en el sector, se dedica al autodesarrollo continuo y toma decisiones estratégicas basadas en análisis y datos",
            detalles: [
              "El distribuidor menciona una serie de ejemplos de programas que realizó para su autodesarrollo (programas gerenciales, cursos, capacitaciones, etc.) y extiende estas posibilidades para otras personas de la distribuidora",
              "Posee una experiencia amplia y sólida que le permite tomar decisiones estratégicas con confianza"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "1.7",
          aspecto: "Proceso de toma de decisión",
          pregunta: "¿Cómo es el proceso de toma de decisiones estratégicas del distribuidor?\n¿Existe algún modelo de gobierno/comité/consultor responsable por las mismas?\n¿El dueño es 100% responsable por la toma de decisión de todos los temas?",
          bajo: {
            titulo: "El dueño tiene control total sobre todas las decisiones importantes, y la delegación es mínima",
            detalles: [
              "El dueño no confía lo suficiente en el equipo para tomar decisiones importantes sin su aprobación",
              "Toman decisiones de forma reactiva, reaccionan tarde",
              "No se anticipan problemas o oportunidades a través de indicadores, se toman decisiones solo cuando surgen problemas visibles"
            ]
          },
          mediano: {
            titulo: "El dueño participa activamente en las decisiones estratégicas, pero delega la toma de decisiones operativas a su equipo",
            detalles: [
              "El dueño no está involucrado en todas las decisiones, pero tiene una supervisión cercana y se asegura de que las acciones tomadas por su equipo estén alineadas con los objetivos generales del negocio",
              "Existe una colaboración constante entre el dueño y sus empleados clave"
            ]
          },
          alto: {
            titulo: "Las decisiones se delegan mayormente a los equipos, y el dueño tiene un papel más de supervisión general, confiando en su equipo para manejar el día a día",
            detalles: [
              "El dueño interviene solo en decisiones mayores o crisis excepcionales",
              "El distribuidor tiene procesos establecidos para la toma de decisiones, donde cada miembro del equipo sabe claramente su rol y los límites de sus responsabilidades"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "1.8",
          aspecto: "Operación de la sucursal",
          pregunta: "¿Las sucursales tienen performance similar?\n¿Hay grande diferencia entre sucursales (estructura, performance, objetivos, etc.)?\n¿Hay responsables específicos para garantizar la ejecución de las sucursales?\n¿El responsable de la sucursal tiene conocimiento de la operación, de la zona y clientes?",
          bajo: {
            titulo: "El distribuidor no tiene responsables para las operaciones de cada tienda y, además, las tiendas tienen una estructura, rendimiento y objetivos comerciales completamente desalineados y distintos",
            detalles: []
          },
          mediano: {
            titulo: "El distribuidor tiene responsables específicos para la operación de cada sucursal, pero no cuentan con conocimiento específico de la zona, los clientes ni de la operación",
            detalles: []
          },
          alto: {
            titulo: "Existen responsables específicos con amplio conocimiento de la zona, los clientes, los desafíos y la operación. Además, las tiendas tienen un rendimiento similar y objetivos de ventas alineados",
            detalles: []
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "1.9",
          aspecto: "Conocimiento del mercado y sus variaciones",
          pregunta: "¿El dueño está atento a la situación actual del mercado, del país y la zona?\n¿Conoce las principales problemáticas del mes, semestre en curso?\n¿Conoce qué está pasando particularmente en su zona?",
          bajo: {
            titulo: "No realiza investigaciones regulares y depende de su experiencia o intuición para gestionar las variaciones del mercado",
            detalles: [
              "No está al tanto de las fluctuaciones estacionales, económicas o sociales que podrían impactar la demanda de productos",
              "Toma decisiones basadas únicamente en su experiencia pasada o en intuiciones, sin tener en cuenta los datos actuales del mercado"
            ]
          },
          mediano: {
            titulo: "Hace investigaciones ocasionales y tiene una comprensión básica de las variaciones del mercado",
            detalles: [
              "Realiza investigaciones de mercado de forma periódica, como encuestas a clientes, análisis de tendencias de ventas o adquisición de algunos informes de la industria",
              "El distribuidor se adapta con cierto retraso a las variaciones del mercado"
            ]
          },
          alto: {
            titulo: "Tiene un conocimiento profundo y actualizado del mercado y adapta sus estrategias de manera proactiva",
            detalles: [
              "Está muy bien informado sobre las fluctuaciones estacionales, económicas, tecnológicas y sociales del mercado",
              "Sabe cómo estos factores pueden afectar la demanda y ajusta sus operaciones de manera proactiva",
              "El distribuidor no solo responde a los cambios en el mercado, sino que los anticipa"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "1.10",
          aspecto: "Conocimiento de tendencias del mercado",
          pregunta: "¿Cómo hace el distribuidor para mantenerse actualizado de las tendencias del mercado?\n¿Conoce las tendencias del negocio y es activo en la implementación de nuevas iniciativas?\n¿El distribuidor participa de eventos, grupos de productores, asociaciones y encuentros anuales del agronegocio en la zona?",
          bajo: {
            titulo: "No realiza investigaciones de mercado regulares, como encuestas, estudios o análisis de competidores",
            detalles: [
              "Las tendencias del mercado se descubren de manera reactiva, solo cuando surgen problemas evidentes",
              "No participa activamente en ferias, conferencias ni eventos del sector",
              "No sigue publicaciones especializadas y no tiene relaciones estrechas con proveedores que le ayuden a obtener información sobre nuevas tendencias"
            ]
          },
          mediano: {
            titulo: "Realiza esfuerzos moderados para mantenerse actualizado",
            detalles: [
              "Invierte en su autodesarrollo realizando cursos esporádicos (al menos uno dentro de los últimos 5 años)",
              "Realiza investigaciones básicas de mercado, pero no son continuas ni profundas",
              "Asiste a algunas ferias comerciales o seminarios del sector, pero su participación puede ser esporádica"
            ]
          },
          alto: {
            titulo: "Está constantemente buscando y utilizando diversas fuentes de información y herramientas tecnológicas para anticipar tendencias",
            detalles: [
              "Se mantiene al tanto de cambios en el comportamiento de los consumidores, nuevas tecnologías y productos",
              "Asiste a eventos de la industria, ferias comerciales, seminarios y conferencias de manera regular, estableciendo relaciones con expertos y actores clave del mercado"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "1.11",
          aspecto: "Gestión de indicadores",
          pregunta: "¿El distribuidor tiene un acompañamiento de indicadores estratégicos?\n¿Hay un proceso de análisis de los indicadores ejecutado vs planeado?\n¿Con qué frecuencia se revisan los indicadores?",
          bajo: {
            titulo: "No tiene ninguna gestión de indicadores estratégicos",
            detalles: [
              "El distribuidor no establece o utiliza indicadores clave de rendimiento de manera consistente",
              "Los datos sobre ventas, inventarios, y otros aspectos operativos están dispersos o no se procesan adecuadamente",
              "Los indicadores no se revisan de manera periódica ni se ajustan según sea necesario"
            ]
          },
          mediano: {
            titulo: "Tiene un uso básico de indicadores y necesitan profesionalización",
            detalles: [
              "El distribuidor utiliza algunos indicadores clave, como ventas mensuales, rotación de inventario o cumplimiento de metas, pero no está completamente integrado en la operación",
              "Se generan informes básicos que reportan la evolución de ciertos aspectos del negocio, aunque no siempre se profundiza en el análisis de los datos"
            ]
          },
          alto: {
            titulo: "Tiene un sistema integral y sofisticado de indicadores, toma decisiones informadas y utilizan tableros/dashboards",
            detalles: [
              "El distribuidor tiene una lista bien definida de KPIs estratégicos que cubren todas las áreas críticas del negocio: ventas, margen, rentabilidad, satisfacción del cliente, desempeño de los empleados, eficiencia operativa, etc.",
              "Los datos son analizados detalladamente para comprender las tendencias, identificar patrones, y hacer proyecciones sobre el futuro"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "1.12",
          aspecto: "Efectividad en la comunicación",
          pregunta: "¿Cómo es la comunicación del distribuidor con Bayer?\n¿Cuáles son los desafíos para una comunicación abierta con Bayer?\n¿Para el distribuidor la relación con Bayer es una relación estratégica con enfoque en crecimiento o más transaccional de toma de pedido?",
          bajo: {
            titulo: "La relación con Bayer es esencialmente transaccional, centrada principalmente en la toma de pedidos y la entrega de productos",
            detalles: [
              "Las interacciones entre Bayer y el distribuidor pueden ser limitadas a aspectos operacionales, como la negociación de precios y el cumplimiento de los pedidos",
              "El distribuidor no tiene una comunicación con Bayer para temas fuera de la facturación"
            ]
          },
          mediano: {
            titulo: "La relación es colaborativa pero limitada",
            detalles: [
              "No hay mucha colaboración más allá de las transacciones básicas de compra-venta",
              "El distribuidor tiene una comunicación con Bayer pero es reactiva",
              "La comunicación es hecha por canales informales"
            ]
          },
          alto: {
            titulo: "El distribuidor ve la relación con Bayer como una comunicación estratégica",
            detalles: [
              "Bayer y el distribuidor trabajan juntos en la planificación a largo plazo, no solo en la venta de productos",
              "La comunicación es hecha por canales oficiales",
              "La comunicación tiene énfasis en el desarrollo del distribuidor o en la creación de valor adicional"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        }
      ]
    },
    {
      id: 2,
      key: "cobertura_acceso",
      name: "Cobertura y Acceso al Mercado",
      weightTotal: 0.20,
      questions: [
        {
          id: "2.1",
          aspecto: "Conocimiento del territorio actual y desarrollo de la zona",
          pregunta: "¿El distribuidor conoce el territorio asignado actualmente?\n¿Cuál es el porcentaje de clientes que el distribuidor atiende vs. potencial de la zona?\n¿Cómo el distribuidor desarrolla la zona actualmente?",
          bajo: {
            titulo: "Bajo conocimiento sobre el territorio asignado",
            detalles: [
              "Atiende a menos de 1/3 del territorio",
              "Unas cuantas Key Accounts que atiende",
              "Sin ambición de captura de clientes",
              "No desarrolla la zona y los clientes"
            ]
          },
          mediano: {
            titulo: "Conocimiento medio sobre el territorio asignado",
            detalles: [
              "Atiende alrededor de la mitad del territorio asignado",
              "Tiene a casi todos los clientes grandes de la región",
              "Esfuerzo en mantener CUPs ya asignados"
            ]
          },
          alto: {
            titulo: "Conocimiento alto sobre el territorio asignado",
            detalles: [
              "Conoce a detalle el territorio asignado",
              "Atiende a la mayoría de los clientes (S2 y S3) de la región",
              "Ambición constante de crecimiento de cobertura de la zona",
              "Tiene ambición de desarrollar la zona y clientes"
            ]
          },
          ponderacionCompetencia: 0.15,
          ponderacionTotal: 0.03
        },
        {
          id: "2.2",
          aspecto: "Nuevos clientes",
          pregunta: "¿El distribuidor tiene un proceso definido de buscar nuevos clientes?\n¿Hay planes para reactivar clientes inactivos?",
          bajo: {
            titulo: "Las acciones son reactivas, es decir, ocurren solo cuando surgen oportunidades",
            detalles: [
              "No tiene un proceso formal para buscar nuevos clientes",
              "Las ventas se basan más en reacciones a oportunidades que surgen de manera espontánea o de solicitudes externas"
            ]
          },
          mediano: {
            titulo: "Tiene algunos planes establecidos para buscar nuevos clientes y reactivar a los inactivos, pero no están completamente optimizados",
            detalles: [
              "Sí busca nuevos clientes pero no es el foco del distribuidor",
              "El foco esta mucho más en las ventas a los clientes que ya conocen o que ya les venden",
              "Reactivos a la inactividad, pero sin estrategia formal"
            ]
          },
          alto: {
            titulo: "Procesos bien definidos y sistemáticos tanto para la búsqueda activa de nuevos clientes como para la reactivación de clientes inactivos",
            detalles: [
              "Tiene un proceso claro y bien estructurado para la búsqueda activa de nuevos clientes",
              "Hay planes bien definidos para la reactivación de clientes inactivos",
              "Hay campañas de reactivación de forma proactiva"
            ]
          },
          ponderacionCompetencia: 0.15,
          ponderacionTotal: 0.03
        },
        {
          id: "2.3",
          aspecto: "Clientes activos sin llegada con Bayer",
          pregunta: "¿El distribuidor llega a muchos clientes activos pero que no llega con Bayer?\n¿Por qué?",
          bajo: {
            titulo: "La mayoría de los clientes que atiende son ya clientes activos de Bayer, sin haber logrado atraer nuevos clientes ajenos a la red de Bayer",
            detalles: []
          },
          mediano: {
            titulo: "El distribuidor tiene una cobertura moderada y ha logrado acceder a algunos clientes activos fuera de la red de Bayer, pero su alcance aún es limitado en comparación con su potencial",
            detalles: []
          },
          alto: {
            titulo: "Ha implementado estrategias efectivas para atraer y retener nuevos clientes que no están actualmente con Bayer, logrando diversificar su base de clientes",
            detalles: []
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "2.4",
          aspecto: "Foco en el canal",
          pregunta: "¿Cuál es el nivel de participación de la venta en grandes productores vs. productores chicos?\n¿Cómo es la llegada/enfoque del distribuidor a clientes productores medianos y chicos?",
          bajo: {
            titulo: "La mayoría de las ventas del distribuidor se concentran en grandes productores. Los pequeños productores tienen una participación mínima o nula en las ventas",
            detalles: []
          },
          mediano: {
            titulo: "Tiene una base de clientes equilibrada entre grandes y pequeños productores, pero los grandes productores todavía representan una parte significativa de las ventas",
            detalles: []
          },
          alto: {
            titulo: "Mantiene una participación equilibrada o incluso una mayor participación en el segmento de pequeños y medianos productores, además de los grandes productores. El distribuidor ha logrado diversificar su base de clientes y logra ventas significativas en todos los segmentos",
            detalles: []
          },
          ponderacionCompetencia: 0.15,
          ponderacionTotal: 0.03
        },
        {
          id: "2.5",
          aspecto: "Cercanía y conocimiento de los productores",
          pregunta: "¿Cómo es la calidad de las relaciones generadas con sus clientes en su zona?\n¿Tienen tiempo de campo y atención a clientes?\n¿Cada cuánto se visita los clientes en promedio?\n¿Tienen un buen feedback de los clientes? ¿Cuáles son los desafíos?",
          bajo: {
            titulo: "Atención reactiva a clientes",
            detalles: [
              "No tienen relaciones tan cercanas con sus cuentas",
              "Toman pedidos, pero no buscan necesidades de clientes y oportunidades de cross-selling",
              "Pasan poco tiempo en campo"
            ]
          },
          mediano: {
            titulo: "Solo tienen relaciones con los productores con mayor facturación",
            detalles: [
              "Tienen relaciones buenas con sus cuentas",
              "En algunas ocasiones incentivan el cross-selling",
              "Visitan el campo de manera regular a cuentas clave"
            ]
          },
          alto: {
            titulo: "Conocimiento a detalle y de campo de la mayoría de sus productores",
            detalles: [
              "Visitan con frecuencia a todas sus cuentas",
              "Relación de asesoría con sus productores y transmisión de knowhow",
              "Muy buen nivel de atención a clientes"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "2.6",
          aspecto: "Segmentación de clientes",
          pregunta: "¿Cuentan con una segmentación/diferenciación de clientes? Por zona, tamaño hectárea, perfil, cultivo, potencial, etc.\n¿El distribuidor utiliza la segmentación de Bayer (S1, S2, etc.)?",
          bajo: {
            titulo: "Segmentación mínima o inexistente",
            detalles: [
              "Puede que se limiten a una categorización general, sin profundizar en las características o necesidades específicas de los clientes",
              "No tiene conocimiento de la segmentación de Bayer (S1, S2, S3 etc.)"
            ]
          },
          mediano: {
            titulo: "La segmentación existe pero de una manera informal y no estandarizada",
            detalles: [
              "El distribuidor comienza a segmentar a sus clientes según criterios como tamaño, cultivo, etc.",
              "Los asesores tienen conocimiento de las diferencias de los clientes, pero no es formal y estandarizado"
            ]
          },
          alto: {
            titulo: "Hay una segmentación avanzada y considera criterios como tipo de cultivo, tamaño de hectáreas, potencial de crecimiento y otros factores clave",
            detalles: [
              "La segmentación se realiza de manera estratégica para identificar los grupos más rentables y con mayor potencial de crecimiento",
              "Conoce la segmentación de Bayer (S2, S2, S3 etc.) y la relaciona con su propia segmentación"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "2.7",
          aspecto: "Modelo de atención a clientes",
          pregunta: "¿Existe un modelo de atención diferenciado para cada tipo de segmento?",
          bajo: {
            titulo: "El distribuidor ofrece un modelo de atención único y estándar para todos los clientes, sin tener en cuenta las diferencias entre los segmentos",
            detalles: []
          },
          mediano: {
            titulo: "El distribuidor tiene un modelo de atención que varía ligeramente según el tipo de cliente, pero las diferencias no son lo suficientemente claras o definidas",
            detalles: []
          },
          alto: {
            titulo: "El distribuidor tiene un modelo de atención completamente diferenciado y adaptado a las características y necesidades de cada segmento de clientes",
            detalles: []
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "2.8",
          aspecto: "Modelos alternativos de venta",
          pregunta: "¿Cuentan con otras formatos de venta para los productores?\nPor ejemplo, televentas, online",
          bajo: {
            titulo: "El distribuidor solo utiliza formatos tradicionales de venta, como ventas directas en persona o a través de visitas comerciales",
            detalles: []
          },
          mediano: {
            titulo: "El distribuidor ha comenzado a implementar algunos canales alternativos de venta, como televentas o ventas por teléfono, pero de forma limitada",
            detalles: []
          },
          alto: {
            titulo: "El distribuidor ha adoptado de manera efectiva múltiples formatos de venta, incluyendo televentas, ventas online, plataformas digitales y otros canales tecnológicos para llegar a los productores",
            detalles: []
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "2.9",
          aspecto: "Reputación en la zona",
          pregunta: "¿Cuál es la reputación que el distribuidor tiene en la zona que opera?\n¿El distribuidor tiene una buena relación con los clientes que atiende?",
          bajo: {
            titulo: "El distribuidor tiene una mala reputación en la zona",
            detalles: [
              "Esto puede ser un obstáculo significativo dado que los clientes pueden desconfiar de sus productos, servicios o prácticas comerciales",
              "Puede deberse a experiencias negativas anteriores, como un mal servicio al cliente o productos de baja calidad"
            ]
          },
          mediano: {
            titulo: "El distribuidor tiene una reputación mixta con clientes leales como detractores",
            detalles: [
              "Hay oportunidad para construir relaciones, pero también será necesario trabajar en las áreas donde la reputación es negativa",
              "Oportunidades en servicio al cliente, oferta de garantías y demostrar la calidad del producto"
            ]
          },
          alto: {
            titulo: "Un distribuidor con una excelente reputación en la zona",
            detalles: [
              "Los clientes confían en sus productos y servicios, lo que facilita la entrada a la nueva área de ventas",
              "Suele recibir recomendaciones de boca a boca y puede negociar mejores condiciones con los proveedores"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        }
      ]
    },
    {
      id: 3,
      key: "gestion_comercial",
      name: "Gestión Comercial y Estructura",
      weightTotal: 0.20,
      questions: [
        {
          id: "3.1",
          aspecto: "Composición del equipo de ventas (asesores)",
          pregunta: "¿Cómo está organizada la estructura comercial del distribuidor?\n¿Hay una estructura especializada para atender a los clientes?\n¿El número de asesores es suficiente para atender los clientes mapeados en la zona?\n¿Hay planes de agregar asesores comerciales en la estructura?",
          bajo: {
            titulo: "Estructura comercial desorganizada e insuficiente para atender las necesidades del mercado",
            detalles: [
              "No existe una estructura definida; las responsabilidades comerciales no están claras ni distribuidas de forma estratégica",
              "No hay especialización en la atención a clientes; todos los clientes son tratados de forma genérica, sin segmentación",
              "El número de asesores es insuficiente para cubrir la zona de influencia",
              "No hay planes concretos para expandir la fuerza de ventas en el corto plazo"
            ]
          },
          mediano: {
            titulo: "Estructura comercial básica, con oportunidades para optimizar la cobertura y especialización",
            detalles: [
              "Existe una estructura general para atender a los clientes, pero carece de segmentación o roles especializados",
              "El número de asesores cubre parcialmente la zona mapeada, aunque algunos segmentos o áreas pueden quedar desatendidos",
              "Hay planes iniciales para incorporar nuevos asesores, pero aún no se han materializado ni definido plazos claros"
            ]
          },
          alto: {
            titulo: "Estructura comercial sólida, especializada y dimensionada para atender de manera efectiva a los clientes",
            detalles: [
              "La estructura comercial está claramente definida, con roles y responsabilidades especializadas",
              "El número de asesores es adecuado y está alineado con el mapeo de clientes en la zona",
              "Existen planes estratégicos para expandir la fuerza de ventas en función del crecimiento del mercado"
            ]
          },
          ponderacionCompetencia: 0.25,
          ponderacionTotal: 0.05
        },
        {
          id: "3.2",
          aspecto: "Estructura comercial de soporte",
          pregunta: "¿Cuentan con un equipo estructurado para soportar las ventas y distribución (supervisores, gerente comercial, coordinador)?\n¿Tienen roles y responsabilidades claros en la estructura de soporte de ventas?",
          bajo: {
            titulo: "La operación del día a día se hace con un equipo reducido y desestructurado",
            detalles: [
              "Está el dueño del negocio con pocos asesores de venta para la necesidad de la cantidad de clientes en la zona",
              "El dueño del negocio hace la mayoría de las actividades",
              "No hay gerencia comercial"
            ]
          },
          mediano: {
            titulo: "La operación del día a día se hace de manera estructurada",
            detalles: [
              "Hay roles y responsabilidades claras del equipo",
              "El equipo cuenta con asesores de venta, coordinadores y una estructura de soporte",
              "Hay asesores comerciales con roles claros pero no hay un perfil de soporte al cliente y una gerencia de ventas estructurada"
            ]
          },
          alto: {
            titulo: "La operación del día a día se hace con un equipo especializado, estructurado y que trabaja de manera eficiente",
            detalles: [
              "Hay roles y responsabilidades claras para todos los puestos",
              "Se tiene una estructura organizacional completa",
              "Los miembros del equipo son especialistas de su puesto",
              "Se tiene una estructura de asesores comerciales con roles y responsabilidades claros, el tamaño correcto y un equipo de gestión comercial para soporte"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "3.3",
          aspecto: "Perfil del equipo de ventas (asesores)",
          pregunta: "¿Cómo es el perfil de los asesores actualmente (formación, experiencia, expertise)?\n¿Los asesores tienen expertise técnico y comercial para la venta consultiva del portafolio de Bayer Innoba en su totalidad?",
          bajo: {
            titulo: "Son asesores con poca experiencia en la industria",
            detalles: [
              "Los asesores comerciales no conocen tanto los aspectos técnicos de los productos",
              "Los asesores no tienen el perfil comercial y consultivo deseado para la actividad",
              "No realizan eventos para activar la relación con productores"
            ]
          },
          mediano: {
            titulo: "Asesores que conocen la industria y los productos",
            detalles: [
              "Los asesores son muy técnicos para el puesto, conocen de la industria y sobre el portafolio de Bayer",
              "Pero los asesores no tienen el perfil comercial y consultivo esperado",
              "Realizan eventos esporádicos para activar generación de demanda"
            ]
          },
          alto: {
            titulo: "Asesores con un alto grado de especialización y habilidades de gestión de cuentas",
            detalles: [
              "Llevan mucho tiempo operando y tienen completa profundidad técnica que se requiere",
              "Conocen productos a profundidad del portafolio de Bayer y tienen perfil comercial y consultivo",
              "Tienen conocimiento de la industria y productos, e investigan sobre innovaciones",
              "Constantemente están en contacto con sus clientes a través de eventos para mejorar ventas"
            ]
          },
          ponderacionCompetencia: 0.25,
          ponderacionTotal: 0.05
        },
        {
          id: "3.4",
          aspecto: "Cartera de clientes por asesor",
          pregunta: "¿Cuántos CUPs (promedio) atiende cada asesor?\n¿Se realizó un cálculo y dimensionamiento de cartera para cada asesor?\n¿Los asesores tienen cantidades similares de clientes por cartera?",
          bajo: {
            titulo: "Falta de dimensionamiento de carteras y desequilibrio en la asignación de clientes",
            detalles: [
              "No se ha realizado un cálculo ni un análisis formal para dimensionar las carteras de los asesores",
              "El número de clientes por asesor varía significativamente",
              "No hay criterios claros para asignar clientes a cada asesor"
            ]
          },
          mediano: {
            titulo: "Carteras parcialmente dimensionadas, pero con oportunidades de mejora en el equilibrio y análisis",
            detalles: [
              "Se realizó un cálculo inicial del número de clientes por asesor, aunque no se toma en cuenta la complejidad o el potencial de cada cliente",
              "Existe una asignación general de clientes, pero aún hay diferencias significativas en las cargas de trabajo",
              "Las carteras no se revisan ni actualizan regularmente"
            ]
          },
          alto: {
            titulo: "Carteras bien dimensionadas y equilibradas para maximizar la efectividad de los asesores",
            detalles: [
              "Se ha realizado un cálculo detallado del número de clientes y su complejidad para asignarlos de manera equitativa",
              "Las carteras están equilibradas, con cantidades similares de clientes por asesor y criterios claros",
              "El dimensionamiento de las carteras se revisa periódicamente"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "3.5",
          aspecto: "Rutinas comerciales",
          pregunta: "¿Hay rutinas comerciales definidas para los asesores agronómicos del distribuidor?\n¿Los asesores tienen claridad del paso a paso de una venta o visita en los clientes?\n¿Cuáles son las rutinas comerciales con las que cuenta el equipo de asesores?",
          bajo: {
            titulo: "Ausencia de rutinas comerciales claras o definidas para los asesores",
            detalles: [
              "No existen rutinas comerciales formalizadas para guiar las acciones de los asesores",
              "Los asesores trabajan de manera improvisada, sin un paso a paso definido para las ventas o visitas a clientes",
              "Falta un proceso estándar que asegure la coherencia en las interacciones comerciales"
            ]
          },
          mediano: {
            titulo: "Rutinas comerciales parcialmente definidas, pero con falta de claridad o consistencia en su implementación",
            detalles: [
              "Se han establecido algunas rutinas comerciales básicas, pero no todas están formalizadas o documentadas",
              "Los asesores tienen un conocimiento general del paso a paso en las ventas o visitas, aunque la ejecución puede variar entre individuos",
              "No son monitoreadas ni actualizadas regularmente"
            ]
          },
          alto: {
            titulo: "Rutinas comerciales bien definidas, claras y aplicadas consistentemente por todos los asesores",
            detalles: [
              "Existe un conjunto de rutinas comerciales documentadas y estructuradas que guían cada etapa de las ventas y visitas a clientes",
              "Los asesores tienen total claridad sobre el paso a paso de cada interacción comercial",
              "Son monitoreadas y revisadas periódicamente para garantizar la consistencia"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "3.6",
          aspecto: "Gestión de las rutinas comerciales",
          pregunta: "¿Cómo es la gestión de las rutinas comerciales y rutinas de los asesores?\n¿El distribuidor cuenta con herramientas para garantizar el paso a paso correcto en las visitas?\n¿Cómo el distribuidor garantiza el cumplimento de las rutinas comerciales?",
          bajo: {
            titulo: "Falta de estructura y herramientas para gestionar las rutinas comerciales",
            detalles: [
              "No existe una planificación ni supervisión clara de las rutinas comerciales de los asesores",
              "El distribuidor no cuenta con herramientas específicas para organizar o controlar el proceso en las visitas",
              "El cumplimiento depende exclusivamente de la iniciativa de los asesores, sin apoyo estructural"
            ]
          },
          mediano: {
            titulo: "Gestión básica con herramientas limitadas, pero con necesidad de mayor formalización",
            detalles: [
              "Existe un seguimiento parcial de las rutinas comerciales, aunque carece de consistencia o profundidad",
              "Se utilizan herramientas manuales o genéricas (como reportes en Excel o formularios)",
              "El cumplimiento de las rutinas se revisa de forma reactiva"
            ]
          },
          alto: {
            titulo: "Gestión profesionalizada y basada en herramientas que garantizan resultados consistentes",
            detalles: [
              "El distribuidor utiliza herramientas tecnológicas o plataformas específicas que guían las rutinas comerciales paso a paso",
              "Existe un sistema de monitoreo constante basado en indicadores clave (KPIs)",
              "Las rutinas comerciales están claramente definidas, documentadas y adoptadas por todos los asesores"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "3.7",
          aspecto: "Reuniones periódicas",
          pregunta: "¿Se realizan reuniones periódicas de revisión de cartera, indicadores, prioridades, planes de acción con los asesores? ¿Con que frecuencia? ¿Qué temas ven en dichas sesiones?",
          bajo: {
            titulo: "Falta de reuniones periódicas y de un enfoque estructurado en la gestión del desempeño comercial",
            detalles: [
              "No se realizan reuniones periódicas, o en períodos mayores a 1 mes, con los asesores para revisar la cartera, indicadores ni planes de acción",
              "La comunicación es reactiva y ocurre solo cuando surge un problema o hay una situación urgente",
              "No hay una estructura definida para tratar temas clave como prioridades, estrategias o acciones correctivas"
            ]
          },
          mediano: {
            titulo: "Reuniones ocasionales con enfoque limitado y falta de consistencia en los temas tratados",
            detalles: [
              "Las reuniones con los asesores se realizan de manera irregular o con poca frecuencia (quincenal o menos)",
              "En las sesiones se revisan principalmente indicadores básicos, como volumen de ventas",
              "Los planes de acción son generales y no siempre se da seguimiento a su ejecución o impacto"
            ]
          },
          alto: {
            titulo: "Reuniones periódicas estructuradas para analizar el desempeño, planificar estrategias y alinear prioridades",
            detalles: [
              "Se realizan reuniones regulares con los asesores para revisar carteras, indicadores clave y prioridades comerciales",
              "Los temas incluyen análisis detallado de resultados, segmentación de clientes, identificación de oportunidades, y definición de planes de acción específicos",
              "Existe un enfoque claro en el seguimiento de compromisos y ajustes estratégicos"
            ]
          },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.01
        },
        {
          id: "3.8",
          aspecto: "Metas de la FDV (Fuerza de Ventas)",
          pregunta: "¿El equipo comercial tiene metas de ventas? ¿De qué tipo? ¿Cómo son medidas?\n¿Metas por producto? ¿Metas de Bayer?",
          bajo: {
            titulo: "Falta de metas claras y de sistemas adecuados para medir el desempeño comercial",
            detalles: [
              "El equipo comercial no tiene metas de ventas definidas o estas son poco claras",
              "No existen herramientas ni indicadores establecidos para medir el desempeño comercial",
              "La medición de resultados se realiza de manera informal o reactiva"
            ]
          },
          mediano: {
            titulo: "Metas básicas definidas, pero con sistemas de medición limitados o inconsistentes",
            detalles: [
              "El equipo comercial tiene metas generales, como ingresos totales o volúmenes de venta, pero carecen de desgloses específicos",
              "La medición del desempeño se realiza con indicadores básicos",
              "Existe un sistema manual o rudimentario para dar seguimiento a las metas"
            ]
          },
          alto: {
            titulo: "Metas de ventas claras, específicas y medidas con herramientas confiables y en tiempo real",
            detalles: [
              "El equipo comercial trabaja con metas específicas y bien definidas, desglosadas por ingresos, volumen, productos estratégicos y clientes clave",
              "El desempeño es monitoreado regularmente mediante herramientas tecnológicas",
              "Existen revisiones periódicas de resultados para ajustar las metas según las necesidades del mercado"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        },
        {
          id: "3.9",
          aspecto: "Remuneración equipo comercial",
          pregunta: "¿Cómo es la política de compensación del equipo de ventas (fijo y variable)?\n¿Cuál es la proporción? (entre fijo y variable)\n¿Cuáles son las variables incluidas (ventas, mix, unidades, márgenes)?\n¿Cómo es la política de compensación de los supervisores y gerentes?",
          bajo: {
            titulo: "Sin esquema variable",
            detalles: [
              "No existe una política formalizada de compensación o incentivos para el equipo de ventas",
              "Los componentes de la compensación no están claramente definidos o varían sin un criterio objetivo",
              "No se utilizan variables como el rendimiento de ventas, márgenes o mix de productos"
            ]
          },
          mediano: {
            titulo: "% variable en su remuneración, pero no alineado a los objetivos de Bayer (ej: Solo volumen)",
            detalles: [
              "Existe una compensación mixta, con una proporción fija y variable, pero la relación no está alineada con los objetivos de Bayer",
              "Las variables de compensación incluyen ventas y unidades",
              "La política de compensación de supervisores y gerentes se diferencia, pero no está completamente estructurada"
            ]
          },
          alto: {
            titulo: "% variable en su remuneración y está alineado con los objetivos de Bayer (ej: empujar mix, innovaciones, cobertura, etc.)",
            detalles: [
              "La política de compensación está claramente estructurada con una proporción equilibrada entre el salario fijo y el componente variable",
              "Las variables de compensación incluyen ventas, mix de productos, unidades y márgenes",
              "Los supervisores y gerentes tienen una política de compensación diferenciada, con incentivos adicionales por el desempeño del equipo"
            ]
          },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.02
        }
      ]
    },
    {
      id: 4,
      key: "generacion_demanda",
      name: "Generación de Demanda y Gestión de Portafólio",
      weightTotal: 0.15,
      questions: [
        {
          id: "4.1",
          aspecto: "Capacidad de generar demanda proactiva",
          pregunta: "¿El distribuidor es proactivo con acciones para promover la generación de demanda en sus clientes en la zona?\n¿Cómo es la relación del distribuidor con sus clientes, generación de valor vs transaccional?",
          bajo: { titulo: "El distribuidor no tiene una estrategia clara para promover la generación de demanda en su zona de operación", detalles: [] },
          mediano: { titulo: "El distribuidor realiza algunas acciones para promover la generación de demanda en su zona, como promociones puntuales, descuentos, o campañas ocasionales", detalles: [] },
          alto: { titulo: "El distribuidor es altamente proactivo en la generación de demanda, implementando estrategias de marketing y ventas continuas: promociones, eventos, demostraciones, capacitación a clientes y campañas de publicidad", detalles: [] },
          ponderacionCompetencia: 0.15,
          ponderacionTotal: 0.0225
        },
        {
          id: "4.2",
          aspecto: "Generación de demanda - Eventos",
          pregunta: "¿Qué tan común es que realicen eventos para generación de demanda / conexión con productores?",
          bajo: { titulo: "Los eventos para la generación de demanda o la conexión con productores son poco frecuentes o inexistentes", detalles: [] },
          mediano: { titulo: "Los eventos tienden a ser más reactivos, como respuestas a solicitudes de los productores", detalles: [] },
          alto: { titulo: "Organiza eventos regularmente: ferias, seminarios, demostraciones, días de campo, webinars y capacitaciones", detalles: [] },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.0075
        },
        {
          id: "4.3",
          aspecto: "Generación de demanda - Pruebas",
          pregunta: "¿Qué tan común es que realicen pruebas, demostraciones, muestras?",
          bajo: { titulo: "No realiza pruebas de productos, demostraciones ni distribuye muestras entre los clientes", detalles: [] },
          mediano: { titulo: "Las pruebas y demostraciones se llevan a cabo principalmente en mercados específicos o para clientes clave, pero no es una estrategia constante", detalles: [] },
          alto: { titulo: "Realiza pruebas, demostraciones y distribuye muestras de manera regular como parte de su estrategia de marketing", detalles: [] },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.0075
        },
        {
          id: "4.4",
          aspecto: "Generación de demanda - Servicios",
          pregunta: "¿Promueven servicios a sus clientes de forma proactiva (ej. servicio de acopio para los productores, laboratorio de suelo, etc)?",
          bajo: { titulo: "No ofrece ni promueve servicios adicionales a sus clientes, o lo hace de manera mínima", detalles: [] },
          mediano: { titulo: "Ofrece algunos servicios adicionales pero no son una parte integral de su propuesta de valor", detalles: [] },
          alto: { titulo: "Promueve activamente servicios a sus clientes y los integra dentro de su oferta de valor", detalles: [] },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.0075
        },
        {
          id: "4.5",
          aspecto: "Generación de demanda - Programas Bayer",
          pregunta: "¿Qué tanto el distribuidor ofrece y promueve los programas de Bayer a los productos (ej. Valora Maíz etc.)?",
          bajo: { titulo: "No tiene una estrategia para incorporar estos programas en su oferta a los clientes", detalles: [] },
          mediano: { titulo: "Utiliza los programas de Bayer en situaciones específicas o a solicitud de los clientes, pero no siempre de manera proactiva", detalles: [] },
          alto: { titulo: "Promociona estos programas de manera proactiva a través de eventos, capacitación, material de marketing y visitas personalizadas", detalles: [] },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.0075
        },
        {
          id: "4.6",
          aspecto: "Interés en el portafolio de Bayer",
          pregunta: "¿El distribuidor ha estado dispuesto a invertir en el portafolio de Bayer (CP, Maíz, Glifo)?\n¿Vende todas las categorías de producto de Bayer?\n¿Se siente cómodo para vender todas las categorías?",
          bajo: { titulo: "Muestra poco interés en general en el portafolio de Bayer y no parece dispuesto a mantener exclusividad", detalles: [] },
          mediano: { titulo: "Muestra interés únicamente en Maíz y Glifo y poco en CP", detalles: ["Interesado en mantener exclusividad para Maíz y Glifo", "No muestra interés en distribuir CP de Bayer"] },
          alto: { titulo: "Muestra interés en Maíz, Glifo y también en CP", detalles: ["Interesado en productos de CP y en mantener exclusividad para Maíz y Glifo"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.015
        },
        {
          id: "4.7",
          aspecto: "Portafolio/servicios complementarios",
          pregunta: "¿Cuáles son los otros productos que el distribuidor maneja?\n¿El portafolio es complementario al de Bayer?\n¿El asesor ofrece todo el portafolio de Bayer o sólo los de alta rotación?",
          bajo: { titulo: "El portafolio no es complementario al de Bayer", detalles: [] },
          mediano: { titulo: "Los productos complementan parcialmente la oferta de Bayer, pero no cubre todas las necesidades", detalles: [] },
          alto: { titulo: "El portafolio del distribuidor es altamente complementario al de Bayer", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.015
        },
        {
          id: "4.8",
          aspecto: "Concentración del portafolio",
          pregunta: "¿Tiene gran concentración de ventas en algunos productos del portafolio de Bayer?\n¿Por qué vende más alguna categoría?\n¿Qué tiene facilidad de vender más y por qué?",
          bajo: { titulo: "Se enfoca solo en productos de alta rotación, ignorando otros del portafolio", detalles: [] },
          mediano: { titulo: "Está familiarizado con varios productos pero no siempre promueve toda la gama disponible", detalles: [] },
          alto: { titulo: "Enfoque proactivo para ofrecer la totalidad del portafolio de Bayer, maximizando el potencial de ventas", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.015
        },
        {
          id: "4.9",
          aspecto: "Desafíos en venta de maíz",
          pregunta: "¿El distribuidor tiene desafío/gaps para vender Maíz?\n¿Cuáles son los principales desafíos en la venta de Maíz?",
          bajo: { titulo: "Enfrenta importantes desafíos o brechas en la venta de maíz", detalles: [] },
          mediano: { titulo: "Hay variabilidad en las ventas según temporada, condiciones del mercado o competencia", detalles: [] },
          alto: { titulo: "Sólida experiencia en la venta de Maíz sin desafíos y cumple con los números", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.015
        },
        {
          id: "4.10",
          aspecto: "Desafíos en venta de CP",
          pregunta: "¿Tiene experiencia en la venta de CP?\n¿Tiene expertise para vender CP?\n¿Cuáles son los desafíos para vender CP en la zona?",
          bajo: { titulo: "Poca o ninguna experiencia en la venta de productos de protección de cultivos (CP)", detalles: ["No tiene el conocimiento técnico necesario para comercializar CP"] },
          mediano: { titulo: "Algo de experiencia en CP", detalles: ["Enfrenta desafíos importantes para la venta de CP", "No cumple con todos los números esperados por Bayer en CP"] },
          alto: { titulo: "Sólida experiencia en la venta de CP, forma parte integral de su portafolio", detalles: ["Alto nivel de conocimiento técnico sobre los CP", "No hay desafíos y cumple con los números"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.015
        },
        {
          id: "4.11",
          aspecto: "Desafíos en venta de glifo",
          pregunta: "¿Tiene desafío/gaps para vender Glifo?\n¿Cuáles son los principales desafíos en la venta de Glifo?",
          bajo: { titulo: "Enfrenta importantes desafíos o brechas en la venta de glifo", detalles: [] },
          mediano: { titulo: "Hay variabilidad en las ventas según temporada, condiciones del mercado o competencia", detalles: [] },
          alto: { titulo: "Sólida experiencia en la venta de glifo sin desafíos y cumple con los números", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.015
        },
        {
          id: "4.12",
          aspecto: "Identidad de marca",
          pregunta: "¿Las oficinas están en buenas condiciones para la operación del día a día?\n¿Las oficinas tienen la identidad de Bayer?",
          bajo: { titulo: "Oficinas no están en buenas condiciones ni tienen identidad de marca de Bayer", detalles: ["Mal mantenimiento impactando sesiones con productores", "Sin identidad de marca ni promoción a productos Bayer"] },
          mediano: { titulo: "Algunas zonas en malas condiciones y otras en buenas", detalles: ["Mantenimiento básico, útil para juntas pero sin identidad de marca de Bayer"] },
          alto: { titulo: "Oficinas en buenas condiciones con identidad de marca de Bayer actualizada y cuidada", detalles: ["Buen mantenimiento incentivando sesiones con productores", "Identidad de marca y promocionales a productos Bayer"] },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.0075
        }
      ]
    },
    {
      id: 5,
      key: "recursos_humanos",
      name: "Recursos Humanos",
      weightTotal: 0.05,
      questions: [
        {
          id: "5.1",
          aspecto: "Desarrollo profesional",
          pregunta: "¿Fomenta la capacitación de sus empleados?\n¿Hacen evaluación de performance de los asesores comerciales?\n¿Posee alguna metodología para evaluación de performance además de ventas?",
          bajo: { titulo: "Capacitación ocasional sin plan estructurado o continuo", detalles: ["Sólo imparte entrenamientos cuando son organizados por proveedores", "No se realizan evaluaciones periódicas de desempeño"] },
          mediano: { titulo: "Esfuerzos limitados en capacitación y evaluación", detalles: ["No cuenta con plan de capacitación a largo plazo", "Las evaluaciones no siempre se siguen con un plan de acción claro"] },
          alto: { titulo: "Enfoque integral y sistemático para capacitación y desarrollo", detalles: ["Programas de capacitación bien definidos y sistemáticos", "Invierte en desarrollo con formación interna y externa", "Evaluaciones regulares basadas en métricas claras"] },
          ponderacionCompetencia: 0.20,
          ponderacionTotal: 0.01
        },
        {
          id: "5.2",
          aspecto: "Desarrollo técnico de asesores",
          pregunta: "¿Promueve el desarrollo técnico de los asesores de manera proactiva?\n¿Los asesores participan en cursos de Bayer?\n¿Tienen plan de entrenamientos para el equipo comercial?",
          bajo: { titulo: "No invierte en capacitación técnica ni desarrollo de habilidades consultivas", detalles: ["No capacita en temas específicos del agronegocio", "Asesores no entrenados en venta consultiva", "Formación mínima"] },
          mediano: { titulo: "Capacitación básica en agronegocios y algunos elementos de venta consultiva", detalles: ["Programas de formación reactivos", "Formación técnica básica"] },
          alto: { titulo: "Enfoque robusto y continuo en desarrollo técnico y venta consultiva", detalles: ["Asesores capacitados exhaustivamente en venta consultiva", "Programas de formación continua con talleres, cursos y webinars"] },
          ponderacionCompetencia: 0.30,
          ponderacionTotal: 0.015
        },
        {
          id: "5.3",
          aspecto: "Definición de áreas y responsabilidades",
          pregunta: "¿Tiene áreas bien definidas (RRHH, Financiera, Logística, etc.)?\n¿Hay responsabilidades claras para cada área?\n¿Tienen liderazgo claro en cada área?",
          bajo: { titulo: "Áreas y responsabilidades poco definidas, liderazgo centralizado en el dueño", detalles: ["Sin estructura organizacional formal", "Funciones de soporte no especializadas", "Se improvisa según necesidades del momento"] },
          mediano: { titulo: "Áreas algo definidas pero con solapamientos y liderazgo parcial", detalles: ["Ha comenzado a estructurar áreas principales pero separación no es clara", "Funciones pueden ser poco especializadas"] },
          alto: { titulo: "Estructura organizacional formal y clara con departamentos bien diferenciados", detalles: ["Áreas altamente especializadas con equipos dedicados", "Estructura bien delineada para crecimiento eficiente"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "5.4",
          aspecto: "Personal administrativo capacitado",
          pregunta: "¿El personal administrativo está capacitado para ejecutar las actividades necesarias?\n¿Hay metas e incentivos para el personal administrativo?",
          bajo: { titulo: "Personal administrativo no capacitado adecuadamente y sin metas claras", detalles: ["No cuenta con formación adecuada", "Sin objetivos definidos de manera estructurada"] },
          mediano: { titulo: "Capacitación básica y metas generales pero no completamente estructuradas", detalles: ["Aprende sobre la marcha de manera reactiva", "Procesos existentes pero no optimizados"] },
          alto: { titulo: "Personal altamente capacitado con metas claras alineadas con la estrategia", detalles: ["Formación profesionalizada", "Metas alineadas con objetivos estratégicos de la empresa"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "5.5",
          aspecto: "Tasa de rotación",
          pregunta: "¿Cuál es el grado de rotación de los empleados?\n¿Cómo es la retención en el equipo?",
          bajo: { titulo: "Alta rotación", detalles: ["Mala relación con empleados", "Mal clima de trabajo", "Rotación mayor al 40%", "Personas duran menos de 3 años"] },
          mediano: { titulo: "Rotación normal para la industria", detalles: ["Relación mixta con empleados", "Prestaciones comunes", "Rotación entre 20% y 40%", "Promedio de permanencia ~5 años"] },
          alto: { titulo: "Rotación muy baja", detalles: ["Empleados felices", "Buenos recursos y remuneración", "Turnover menor al 20%", "Promedio de permanencia más de 10 años"] },
          ponderacionCompetencia: 0.30,
          ponderacionTotal: 0.015
        }
      ]
    },
    {
      id: 6,
      key: "competencia_financiera",
      name: "Competencia Financiera",
      weightTotal: 0.05,
      questions: [
        {
          id: "6.1",
          aspecto: "Planeación financiera",
          pregunta: "¿Hay planes de presupuesto para el año?\n¿Definen estrategias de inversiones basadas en una planeación financiera?",
          bajo: { titulo: "Gestión pobre de finanzas", detalles: ["Sin presupuesto anual formalizado", "Sin modelo de gobierno para revisar resultados financieros"] },
          mediano: { titulo: "Gestión básica de finanzas", detalles: ["Presupuesto anual poco detallado", "Revisan resultados de manera activa"] },
          alto: { titulo: "Buena gestión financiera con profesionalismo", detalles: ["Presupuesto detallado alineado con metas estratégicas", "Estrategias de inversión basadas en análisis profundo", "Sesiones activas de evaluación de mejoras"] },
          ponderacionCompetencia: 0.20,
          ponderacionTotal: 0.01
        },
        {
          id: "6.2",
          aspecto: "Efectividad en el Control de Costos",
          pregunta: "¿Conoce las principales líneas de costo?\n¿Cómo están divididos los costos fijos y variables?\n¿Cómo se realizan los análisis de costos?\n¿Tienen planes de disminución de costos?",
          bajo: { titulo: "Baja noción de sus costos de operación", detalles: ["Sin comprensión clara de líneas de costos", "Sin claridad entre costos fijos y variables", "Decisiones financieras empíricas"] },
          mediano: { titulo: "Dominio a grandes rasgos sin plan concreto de reducción", detalles: ["Conoce costos pero sin visibilidad precisa del impacto en rentabilidad", "Conocimiento general de márgenes pero no constante"] },
          alto: { titulo: "Conoce bien sus costos con herramientas de control y planes de optimización", detalles: ["Conocimiento exhaustivo de todas las líneas de costos", "Análisis exhaustivo de márgenes por producto"] },
          ponderacionCompetencia: 0.30,
          ponderacionTotal: 0.015
        },
        {
          id: "6.3",
          aspecto: "Rentabilidad del distribuidor",
          pregunta: "¿Cuál es la rentabilidad con Bayer?\n¿Realiza análisis de rentabilidad por proveedor o líneas de producto?\n¿Existe plan de mejora de la rentabilidad?",
          bajo: { titulo: "No realiza análisis sistemático de rentabilidad", detalles: ["Sin enfoque claro para evaluar rentabilidad de productos o proveedores"] },
          mediano: { titulo: "Análisis básicos de rentabilidad", detalles: ["Realiza por líneas de categoría o proveedores", "Seguimiento básico de márgenes"] },
          alto: { titulo: "Análisis exhaustivo de rentabilidad para cada proveedor y línea de producto", detalles: ["Herramientas avanzadas para decisiones informadas", "Ajusta estrategia continuamente para maximizar márgenes"] },
          ponderacionCompetencia: 0.30,
          ponderacionTotal: 0.015
        },
        {
          id: "6.4",
          aspecto: "Salud Financiera",
          pregunta: "¿Cómo son sus fuentes de financiamiento?\n¿Tiene activos en garantía?\n¿Hay grandes inversiones recientes?",
          bajo: { titulo: "Depende de fuentes internas, rara vez recurre a créditos externos", detalles: ["No ha realizado grandes inversiones recientemente"] },
          mediano: { titulo: "Fuentes de financiamiento mixtas con recursos propios y préstamos moderados", detalles: [] },
          alto: { titulo: "Estrategia de financiamiento diversificada con fondos propios y fuentes externas", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "6.5",
          aspecto: "Riesgo de quiebra",
          pregunta: "¿Tiene algún proveedor que pese arriba del 50% en su facturación?\n¿Se ha identificado algún rasgo estructural que genere riesgos de quiebra?",
          bajo: { titulo: "Alto riesgo de quiebra", detalles: ["Proveedor que representa más del 50% de facturación", "Problemas estructurales importantes identificados"] },
          mediano: { titulo: "Proveedores grandes que representan gran parte de la facturación", detalles: ["Algunos problemas estructurales que podrían generar riesgos"] },
          alto: { titulo: "Sin alto riesgo de quiebra", detalles: ["Ningún proveedor representa más del 50%", "Sin problemas estructurales significativos"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        }
      ]
    },
    {
      id: 7,
      key: "digitalizacion",
      name: "Digitalización",
      weightTotal: 0.05,
      questions: [
        {
          id: "7.1",
          aspecto: "Conectividad al Sell Out Reader",
          pregunta: "¿El distribuidor está conectado al Sell Out Reader?",
          bajo: { titulo: "No está conectado con Sell Out Reader", detalles: [] },
          mediano: { titulo: "Está conectado a Sell Out Reader pero la información y datos no son 100% confiables", detalles: [] },
          alto: { titulo: "Está conectado a Sell Out Reader y tiene información confiable", detalles: [] },
          ponderacionCompetencia: 0.15,
          ponderacionTotal: 0.0075
        },
        {
          id: "7.2",
          aspecto: "Uso de Field View",
          pregunta: "¿El distribuidor promueve el uso de Field View para sus clientes?\n¿Para el distribuidor la herramienta Field View tiene valor para sus clientes?\n¿Cuáles son los desafíos para su uso?",
          bajo: { titulo: "No promueve la utilización de Field View y no tiene conocimiento de la herramienta", detalles: [] },
          mediano: { titulo: "Conoce la herramienta y empezó a promover la utilización, pero aún hay un largo camino para mejorar", detalles: [] },
          alto: { titulo: "Promueve la utilización de Field View por completo y sabe el valor de la herramienta para sus clientes", detalles: [] },
          ponderacionCompetencia: 0.15,
          ponderacionTotal: 0.0075
        },
        {
          id: "7.3",
          aspecto: "Capabilities digitales",
          pregunta: "¿El distribuidor está buscando la digitalización?\n¿Cuáles son los planes del distribuidor para la digitalización?\n¿Cómo es la cultura de innovación y desarrollo tecnológico del distribuidor?",
          bajo: { titulo: "No está buscando la digitalización y no hay planes claros", detalles: [] },
          mediano: { titulo: "Interés moderado, algunos proyectos de innovación y están empezando a explorar soluciones digitales", detalles: [] },
          alto: { titulo: "Activa y claramente enfocado en la digitalización con plan integral en toda la operación", detalles: [] },
          ponderacionCompetencia: 0.30,
          ponderacionTotal: 0.015
        },
        {
          id: "7.4",
          aspecto: "Estructura digital",
          pregunta: "¿El distribuidor tiene una estructura para la era digital?\n¿Tienen capacidad de data intelligence (cruces, utilización y visualización de datos)?",
          bajo: { titulo: "No tiene una estructura digital definida y no hay capacidad de análisis de datos", detalles: [] },
          mediano: { titulo: "Herramientas básicas de análisis y visualización de datos, sin estructura específica para digital", detalles: [] },
          alto: { titulo: "Estructura sólida y recursos dedicados a la digitalización con capacidad avanzada de análisis, cruce y visualización de datos", detalles: [] },
          ponderacionCompetencia: 0.15,
          ponderacionTotal: 0.0075
        },
        {
          id: "7.5",
          aspecto: "Inversiones en Sistemas (ERP)",
          pregunta: "¿El distribuidor tiene un Sistema de Gestión con módulos que conectan las diferentes áreas de la empresa (ejemplo, Icarus, Synagro, Tango)?\n¿Cómo utilizan el ERP dentro del distribuidor?",
          bajo: { titulo: "No existe un sistema integrado de gestión para las áreas de distribución", detalles: ["No tiene gestión completa desde recepción de mercancía hasta entrega", "No hay consolidación de ventas por clientes ni historiales"] },
          mediano: { titulo: "Sistema de gestión existente pero con utilización limitada", detalles: ["No tiene gestión completa desde recepción hasta entrega", "Utilización parcial del sistema"] },
          alto: { titulo: "Existe un sistema de gestión integrado con buen nivel de utilización", detalles: ["Garantiza gestión de inventario, pedidos y otras operaciones", "Posibilidad de cruzar datos de ventas"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "7.6",
          aspecto: "Inversiones en Sistemas (CRM)",
          pregunta: "¿El distribuidor tiene un CRM?\n¿Cómo se utiliza el CRM dentro del distribuidor (ejemplo: Salesforce, Pipedrive, Plug CRM, NectarCRM, Hubspot)?",
          bajo: { titulo: "No utiliza un sistema CRM", detalles: ["Toda la información del cliente está centralizada en la figura del vendedor"] },
          mediano: { titulo: "Utilizan herramientas para gestionar el CRM (archivos ordenados ej. Excel)", detalles: ["No hay utilización de un sistema específico"] },
          alto: { titulo: "Hay un sistema CRM que concentra todos los datos de los clientes", detalles: ["Utiliza el CRM para gestionar la interacción y datos de los clientes"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "7.7",
          aspecto: "Comunicación en redes",
          pregunta: "¿Cuenta con una estrategia de comunicación en redes?\n¿Tiene un proceso o agenda para garantizar publicaciones en las redes sociales?\n¿Cómo utiliza las redes sociales, con qué objetivo?",
          bajo: { titulo: "Sin presencia en redes sociales", detalles: ["Si está en redes, su actividad es esporádica y sin estrategia definida"] },
          mediano: { titulo: "Presencia en las redes pero sin estrategia optimizada", detalles: ["Perfiles activos con contenido publicado", "Estrategia no completamente optimizada ni alineada con objetivos comerciales"] },
          alto: { titulo: "Uso de múltiples plataformas con estrategia clara y definida", detalles: ["Estrategia alineada con objetivos generales de la empresa", "Presencia activa y coherente en varias plataformas clave adaptando contenido"] },
          ponderacionCompetencia: 0.05,
          ponderacionTotal: 0.0025
        }
      ]
    },
    {
      id: 8,
      key: "logistica_operaciones",
      name: "Logística y Operaciones",
      weightTotal: 0.05,
      questions: [
        {
          id: "8.1",
          aspecto: "Espacio del depósito",
          pregunta: "¿Tiene el depósito bien estructurado para almacenar los productos de Bayer?\n¿Los depósitos actuales son suficientes para cubrir la zona y crecer?\n¿El espacio está ordenado y limpio?\n¿Hay planes de expansión del depósito?",
          bajo: { titulo: "Estructura de depósito inadecuada, falta de espacio y desorden generalizado", detalles: ["Depósito no organizado ni estructurado eficientemente", "No son suficientes para cubrir la zona", "Espacio desordenado y sucio", "No existen planes de expansión"] },
          mediano: { titulo: "Depósito funcional, pero con espacio limitado y falta de organización en algunas áreas", detalles: ["Estructura básica, algunos productos no almacenados eficientemente", "En picos de demanda puede ser insuficiente", "Ordenado en su mayoría", "Planes preliminares de expansión sin plazos claros"] },
          alto: { titulo: "Depósito bien estructurado, eficiente y con planes claros de expansión", detalles: ["Perfectamente estructurado y optimizado", "Adecuado para cubrir la zona incluso en picos de demanda", "Espacio ordenado, limpio y optimizado", "Planes claros de expansión con plazos definidos"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "8.2",
          aspecto: "Grado de ocupación",
          pregunta: "¿Cuál es el porcentaje de ocupación del depósito? (% Total)",
          bajo: { titulo: "Por debajo del 50% o por arriba del 95%", detalles: [] },
          mediano: { titulo: "Entre 50% y 70% o entre 85% y 95%", detalles: [] },
          alto: { titulo: "70% a 85%", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "8.3",
          aspecto: "Gestión de Stock y Flota en épocas con pico de ventas",
          pregunta: "¿Enfrenta períodos de pico de ventas? ¿Tiene problemas de entregas?\n¿El distribuidor gestiona su flota y stock adecuadamente para evitar problemas en la entrega?",
          bajo: { titulo: "No consigue mitigar los periodos de pico e incluso fuera de las épocas pico enfrenta problemas de falta de vehículos o productos", detalles: [] },
          mediano: { titulo: "No enfrenta problemas fuera de los períodos pico, pudiendo tener entregas no programadas o falta de producto compatibles con la intensidad del pico", detalles: [] },
          alto: { titulo: "No enfrenta problemas de entregas", detalles: [] },
          ponderacionCompetencia: 0.20,
          ponderacionTotal: 0.01
        },
        {
          id: "8.4",
          aspecto: "Equipo en el almacén",
          pregunta: "¿Cuenta con un equipo para asegurar la operación (jefe logístico, operadores etc.)?\n¿Cuenta con suficientes personas en el área de depósito y logística?\n¿El equipo de logística está bien dimensionado?",
          bajo: { titulo: "No hay personal dedicado para el depósito", detalles: ["Se utiliza equipo de otras áreas para la gestión del depósito", "Poca amortiguación para picos de demanda"] },
          mediano: { titulo: "Equipo pequeño dedicado", detalles: ["Equipo reducido completamente dedicado a gestión del depósito", "No se cuenta con equipo adicional en caso de picos"] },
          alto: { titulo: "Equipo dedicado con suficiente personal para cubrir picos de demanda", detalles: ["Equipo dedicado y entrenados con estructura de soporte y sustitutos", "Pueden operar en caso de inconvenientes o picos de demanda"] },
          ponderacionCompetencia: 0.30,
          ponderacionTotal: 0.015
        },
        {
          id: "8.5",
          aspecto: "Gestión de inventario",
          pregunta: "¿Existe un control de días de inventario?\n¿Cómo es el proceso para garantizar producto en el distribuidor?",
          bajo: { titulo: "Falta de control de inventarios y procesos ineficientes", detalles: ["No existe control sistemático de días de inventario", "No tiene proceso claro para períodos pico", "Proceso desorganizado sin visibilidad en la cadena de suministro"] },
          mediano: { titulo: "Control de inventario básico con dificultades en picos de ventas", detalles: ["Control manual o básico sin optimización de rotación", "Respuesta ante picos no totalmente estructurada", "Proceso parcialmente controlado con supervisión manual"] },
          alto: { titulo: "Control de inventarios eficiente y procesos bien estructurados", detalles: ["Control automatizado y optimizado con seguimiento detallado", "Procesos establecidos para picos de ventas con previsiones anticipadas", "Proceso integrado con cadena de suministro usando herramientas de pronóstico"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "8.6",
          aspecto: "Gestión de entregas",
          pregunta: "¿Tiene problemas de entregas?\n¿Cómo gestiona su flota y stock para evitar problemas?\n¿Cómo maneja la eficiencia de entrega?\n¿Cuál es el tiempo promedio de entrega?",
          bajo: { titulo: "Problemas frecuentes en entregas debido a gestión inadecuada de flota y stock", detalles: ["Retrasos, errores o incumplimiento de tiempos", "Sin gestión estructurada de flota ni stock", "Sin lógica de optimización de rutas", "Eficiencia en entregas no se mide ni optimiza"] },
          mediano: { titulo: "Problemas puntuales de entregas con algunas medidas de control", detalles: ["Problemas ocasionales pero mayoría de pedidos se cumple en tiempo", "Gestión mediante procesos básicos", "Rutas optimizadas pero fijas e inflexibles", "Esfuerzos de mejora pero métricas no completamente integradas"] },
          alto: { titulo: "Entrega eficiente y sin problemas gracias a gestión avanzada", detalles: ["Alta tasa de cumplimiento en tiempos de entrega", "Flota y stock gestionados eficientemente con herramientas", "Rutas optimizadas que se ajustan según necesidad", "Métricas claras de desempeño que se revisan continuamente"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "8.7",
          aspecto: "Gestión de la facturación",
          pregunta: "¿Tiene buena gestión de proceso de facturación?\n¿Cuántas veces promedio modifica el pedido?\n¿Cuántas notas de crédito emiten?",
          bajo: { titulo: "Proceso de facturación desorganizado", detalles: ["No tiene un proceso estandarizado"] },
          mediano: { titulo: "Proceso de facturación básico con áreas de mejora en precisión y eficiencia", detalles: ["Proceso definido pero con errores o retrasos frecuentes que requieren correcciones manuales"] },
          alto: { titulo: "Proceso de facturación eficiente, preciso y con controles avanzados", detalles: ["Proceso bien estructurado, automatizado, que minimiza errores y asegura precisión"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        }
      ]
    },
    {
      id: 9,
      key: "seguridad_sustentabilidad",
      name: "Seguridad, Higiene y Sustentabilidad",
      weightTotal: 0.05,
      questions: [
        {
          id: "9.1",
          aspecto: "Requisitos CASAFE",
          pregunta: "¿Se cumplen los requisitos de seguridad y compliance para poder operar con Bayer (CASAFE)?",
          bajo: { titulo: "Muchos de los requisitos de la CASAFE no se cumplen por el distribuidor", detalles: [] },
          mediano: { titulo: "Cumple con la mayoría de las normativas de seguridad y calidad, pero puede tener algunas áreas de mejora", detalles: [] },
          alto: { titulo: "Operan con base en los requerimientos de la CASAFE", detalles: [] },
          ponderacionCompetencia: 0.20,
          ponderacionTotal: 0.01
        },
        {
          id: "9.2",
          aspecto: "Habilitación municipal",
          pregunta: "¿El distribuidor cuenta con habilitación municipal?",
          bajo: { titulo: "No cumple con las habilitaciones necesarias", detalles: [] },
          mediano: { titulo: "Cumple con las habilitaciones pero hay oportunidad para ajustes", detalles: [] },
          alto: { titulo: "Cumple con habilitación municipal y tiene sistemas de auditoría interna para garantizar cumplimiento continuo", detalles: [] },
          ponderacionCompetencia: 0.20,
          ponderacionTotal: 0.01
        },
        {
          id: "9.3",
          aspecto: "Habilitación provincial",
          pregunta: "¿El distribuidor cuenta con habilitación provincial?",
          bajo: { titulo: "No cumple con las habilitaciones necesarias", detalles: [] },
          mediano: { titulo: "Cumple con las habilitaciones pero hay oportunidad para ajustes", detalles: [] },
          alto: { titulo: "Cumple con habilitación provincial y tiene sistemas de auditoría interna para garantizar cumplimiento continuo", detalles: [] },
          ponderacionCompetencia: 0.20,
          ponderacionTotal: 0.01
        },
        {
          id: "9.4",
          aspecto: "Políticas de seguridad de almacén para semillas",
          pregunta: "¿Cuentan con un almacén que tiene los requerimientos para almacenaje de semillas que define Bayer?",
          bajo: { titulo: "Sus almacenes no cumplen con todas las políticas para resguardo de semillas de Bayer", detalles: [] },
          mediano: { titulo: "Sus almacenes cumplen con algunas políticas para resguardo de semillas de Bayer", detalles: [] },
          alto: { titulo: "Sus almacenes cumplen con todas las políticas para resguardo de semillas de Bayer", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "9.5",
          aspecto: "Políticas de seguridad de almacén para agroquímicos",
          pregunta: "¿Cuentan con un almacén que tiene los requerimientos para almacenaje de agroquímicos que define Bayer?",
          bajo: { titulo: "Sus almacenes no cumplen con todas las políticas para resguardo de agroquímicos de Bayer", detalles: [] },
          mediano: { titulo: "Sus almacenes cumplen con algunas políticas para resguardo de agroquímicos de Bayer", detalles: [] },
          alto: { titulo: "Sus almacenes cumplen con todas las políticas para resguardo de agroquímicos de Bayer", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "9.6",
          aspecto: "Políticas de Sustentabilidad",
          pregunta: "¿Se siguen estrategias de sustentabilidad?\n¿Se han implementado acciones de sustentabilidad?",
          bajo: { titulo: "No cumple ninguna agenda sostenible o acciones proactivas en ese tema", detalles: [] },
          mediano: { titulo: "Tiene algunas acciones de sostenibilidad pero son reactivas y hay oportunidad para ser más activo", detalles: [] },
          alto: { titulo: "Es super activo en las acciones sustentables y ha implementado varias acciones de sustentabilidad", detalles: [] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        },
        {
          id: "9.7",
          aspecto: "Normas de seguridad / Equipo y entrenamientos",
          pregunta: "¿Se cuenta con todo el equipo necesario para el manejo de químicos?\n¿Los equipos conocen las reglas y normas para manejo de productos?\n¿Se imparten entrenamientos para reforzar conocimiento?",
          bajo: { titulo: "Equipos básicos y limitados para manejo seguro de productos químicos", detalles: ["Conocimiento básico de normativas de seguridad", "No hay entrenamientos"] },
          mediano: { titulo: "Hay estructura para manejo de las categorías", detalles: ["No hay entrenamientos para reforzar conocimiento"] },
          alto: { titulo: "Equipos avanzados y tecnología de monitoreo para control de productos químicos", detalles: ["Conocimiento profundo y actualizado de todas las normativas", "Entrenamientos continuos, simulacros de emergencias y auditorías externas"] },
          ponderacionCompetencia: 0.10,
          ponderacionTotal: 0.005
        }
      ]
    }
  ]
};

const PILARES = [
  {
    id: "ec",
    key: "excelencia_comercial",
    name: "Excelencia Comercial",
    shortName: "Excelencia Comercial",
    color: "#0068B4",
    colorRgba: "rgba(0, 104, 180, 0.25)",
    categoryKeys: ["vision_estrategica", "gestion_comercial", "generacion_demanda"]
  },
  {
    id: "eo",
    key: "excelencia_operacional",
    name: "Excelencia Operacional",
    shortName: "Excelencia Operacional",
    color: "#00824B",
    colorRgba: "rgba(0, 130, 75, 0.25)",
    categoryKeys: ["recursos_humanos", "competencia_financiera", "logistica_operaciones", "seguridad_sustentabilidad"]
  },
  {
    id: "cx",
    key: "experiencia_cliente",
    name: "CX · Experiencia Cliente",
    shortName: "CX",
    color: "#F57C00",
    colorRgba: "rgba(245, 124, 0, 0.25)",
    categoryKeys: ["cobertura_acceso"]
  },
  {
    id: "dig",
    key: "digitalizacion_nbm",
    name: "Digitalización y Nuevos Modelos de Negocio",
    shortName: "Digital & NBM",
    color: "#7B1FA2",
    colorRgba: "rgba(123, 31, 162, 0.25)",
    categoryKeys: ["digitalizacion"]
  }
];

// Helpers para navegar pilares/categorías
function getPilarByCategoryKey(catKey) {
  return PILARES.find(p => p.categoryKeys.includes(catKey));
}

function getPilarIndexByCategoryIndex(catIndex) {
  const cat = ASSESSMENT_DATA.categories[catIndex];
  if (!cat) return 0;
  const pilar = getPilarByCategoryKey(cat.key);
  if (!pilar) return 0;
  return PILARES.indexOf(pilar);
}

function getCategoriesForPilar(pilarIndex) {
  const pilar = PILARES[pilarIndex];
  if (!pilar) return [];
  return pilar.categoryKeys
    .map(k => ASSESSMENT_DATA.categories.findIndex(c => c.key === k))
    .filter(i => i >= 0);
}

