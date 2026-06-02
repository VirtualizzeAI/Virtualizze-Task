export async function extractFileText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.pdf')) {
    return extractPdfText(file)
  }

  if (lowerName.endsWith('.docx')) {
    return extractDocxText(file)
  }

  return readPlainText(file)
}

async function readPlainText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de texto.'))
    reader.readAsText(file, 'utf-8')
  })
}

async function extractPdfText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdfjsLib = (await import('pdfjs-dist')) as {
      getDocument: (input: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (index: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }> }> }
      GlobalWorkerOptions?: { workerSrc: string }
      version?: string
    }

    if (pdfjsLib.GlobalWorkerOptions) {
      const version = pdfjsLib.version ?? '5.4.296'
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: string[] = []

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (pageText) {
        pages.push(pageText)
      }
    }

    return pages.join('\n\n')
  } catch {
    throw new Error('Não foi possível extrair texto do PDF.')
  }
}

async function extractDocxText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const mammoth = (await import('mammoth/mammoth.browser')) as {
      extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    }
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
  } catch {
    throw new Error('Não foi possível extrair texto do DOCX.')
  }
}
