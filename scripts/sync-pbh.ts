
import { parse } from "csv-parse/sync";
import proj4 from "proj4";
import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

const DATASET_URL =
  "https://dados.pbh.gov.br/dataset/rede-de-assistencia-saude";

const API_URL =
  "https://dados.pbh.gov.br/api/3/action/package_show?id=rede-de-assistencia-saude";

const ESPG_31983 =
  "+proj=utm +zone=23 +south +ellps=GRS80 +units=m +no_defs +type=crs";

const UPAS_ESPERADAS = [
  "barreiro",
  "centro-sul",
  "leste",
  "nordeste",
  "noroeste",
  "norte",
  "oeste",
  "pampulha",
  "venda-nova",
];

type CsvRow = Record<string, string>;

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function campo(
  row: CsvRow,
  ...nomes: string[]
): string {
  const procurados = nomes.map((nome) =>
    normalizar(nome).replace(/[^a-z0-9]/g, ""),
  );

  const entrada = Object.entries(row).find(([chave]) =>
    procurados.includes(
      normalizar(chave).replace(/[^a-z0-9]/g, ""),
    ),
  );

  return String(entrada?.[1] ?? "").trim();
}


function slugDaUpa(nome: string): string {
  const nomeNormalizado = normalizar(nome)
    .replace(/^unidade de pronto atendimento\s*/, "")
    .replace(/^upa\s*/, "");

  const slug = nomeNormalizado
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // A PBH também identifica a UPA Noroeste como UPA Odilon Behrens.
  if (slug.includes("odilon-behrens")) {
    return "noroeste";
  }

  return slug;
}


function converterGeometria(geometria: string) {
  const resultado = geometria.match(
    /POINT\s*(?:Z\s*)?\(\s*(-?[\d.]+)\s+(-?[\d.]+)/i,
  );

  if (!resultado) {
    throw new Error(`Geometria inválida: ${geometria}`);
  }

  const x = Number(resultado[1]);
  const y = Number(resultado[2]);

  const [lng, lat] = proj4(
    ESPG_31983,
    "EPSG:4326",
    [x, y],
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -20.5 ||
    lat > -19 ||
    lng < -45 ||
    lng > -43
  ) {
    throw new Error(
      `Coordenadas fora da região esperada de BH: ${geometria}`,
    );
  }

  return { lat, lng };
}

async function buscarDadosPBH() {
  const resposta = await fetch(API_URL);

  if (!resposta.ok) {
    throw new Error(
      `Falha ao consultar o catálogo da PBH: HTTP ${resposta.status}`,
    );
  }

  const catalogo = await resposta.json() as {
    success: boolean;
    result?: {
      resources?: Array<{
        name?: string;
        title?: string;
        format?: string;
        url?: string;
      }>;
    };
  };

  if (!catalogo.success || !catalogo.result?.resources) {
    throw new Error("A resposta do catálogo da PBH é inválida.");
  }

  const recursos = catalogo.result.resources
    .filter((recurso) => {
      const nome = recurso.name ?? recurso.title ?? "";
      return (
        /rede.*assistencia.*saude/i.test(nome) &&
        /csv/i.test(recurso.format ?? "") &&
        Boolean(recurso.url)
      );
    })
    .sort((a, b) =>
      (b.name ?? b.title ?? "").localeCompare(
        a.name ?? a.title ?? "",
      ),
    );

  const recurso = recursos[0];

  if (!recurso?.url) {
    throw new Error("Nenhum CSV válido da Rede de Assistência Saúde foi encontrado.");
  }

  console.log(`Fonte consultada: ${recurso.url}`);

  const respostaCsv = await fetch(recurso.url);

  if (!respostaCsv.ok) {
    throw new Error(
      `Falha ao baixar o CSV: HTTP ${respostaCsv.status}`,
    );
  }

  const bytes = await respostaCsv.arrayBuffer();
  const texto = new TextDecoder("windows-1252").decode(bytes);
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] ?? "";
  const delimitador =
    (primeiraLinha.match(/;/g) ?? []).length >
    (primeiraLinha.match(/,/g) ?? []).length
      ? ";"
      : ",";

  const linhas = parse(texto, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: delimitador,
  }) as CsvRow[];

  if (linhas.length === 0) {
    throw new Error("O CSV da PBH não contém registros.");
  }

  return { linhas, urlRecurso: recurso.url };
}

async function main() {
  const teste = process.argv.includes("--dry-run");
  const { linhas, urlRecurso } = await buscarDadosPBH();

  const registros = linhas.filter((row) => {
    const categoria = campo(row, "CATEGORIA", "SIGLA_CATEGORIA");
    const nome = campo(row, "NOME");

    return /\bUPA\b|PRONTO ATENDIMENTO/i.test(
      `${categoria} ${nome}`,
    );
  });

  const unidades = registros.map((row) => {
    const idPbh = campo(row, "ID_EQ_SAUDE");
    const nome = campo(row, "NOME");
    const geometria = campo(row, "GEOMETRIA");
    const slug = slugDaUpa(nome);

    if (!idPbh || !nome || !geometria) {
      throw new Error(
        `Registro sem identificador, nome ou geometria: ${JSON.stringify(row)}`,
      );
    }

    const { lat, lng } = converterGeometria(geometria);
    const tipoLogradouro = campo(row, "TIPO_LOGRADOURO");
    const logradouro = campo(row, "LOGRADOURO");
    const numero = campo(row, "NUMERO_IMOVEL");
    const endereco = [
      tipoLogradouro,
      logradouro,
      numero,
    ].filter(Boolean).join(" ");

    const telefone = campo(row, "TELEFONE");

    return {
      slug,
      dados: {
        nome,
        endereco,
        bairro: campo(row, "NOME_BAIRRO_POPULAR"),
        telefone: telefone
          ? telefone.split(/[;,/]/).map((item) => item.trim()).filter(Boolean)
          : [],
        lat,
        lng,
        idPbh,
        fontePbh: DATASET_URL,
        recursoPbh: urlRecurso,
        atualizadoEm: new Date().toISOString(),
      },
    };
  });

  const slugs = unidades.map((unidade) => unidade.slug);

  if (
    unidades.length !== UPAS_ESPERADAS.length ||
    new Set(slugs).size !== UPAS_ESPERADAS.length ||
    !UPAS_ESPERADAS.every((slug) => slugs.includes(slug))
  ) {
    throw new Error(
      `Validação interrompida. Esperadas 9 UPAs (${UPAS_ESPERADAS.join(", ")}), mas foram encontradas: ${slugs.join(", ") || "nenhuma"}. Nenhum dado foi gravado.`,
    );
  }

  console.log(`Validação concluída: ${unidades.length} UPAs.`);
  console.table(
    unidades.map(({ slug, dados }) => ({
      slug,
      nome: dados.nome,
      lat: dados.lat,
      lng: dados.lng,
    })),
  );

  if (teste) {
    console.log("Modo de teste: nenhum dado foi gravado no Firestore.");
    return;
  }

  const credencial = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!credencial || !projectId) {
    throw new Error(
      "Configure FIREBASE_SERVICE_ACCOUNT_JSON e FIREBASE_PROJECT_ID antes de gravar no Firestore.",
    );
  }

  const app = getApps()[0] ?? initializeApp({
    credential: cert(JSON.parse(credencial)),
    projectId,
  });

  const db = getFirestore(app);
  const lote = db.batch();

  for (const unidade of unidades) {
    const referencia = db.collection("unidades").doc(unidade.slug);

    lote.set(
      referencia,
      {
        ...unidade.dados,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  await lote.commit();
  console.log("Sincronização concluída com sucesso.");
}

main().catch((erro: unknown) => {
  console.error(
    "Erro na sincronização:",
    erro instanceof Error ? erro.message : erro,
  );
  process.exitCode = 1;
});
