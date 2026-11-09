export type PlantProfile = {
  name: string;
  latinName: string;
  icon: string;
  category: string;
  description: string;
  traditionalUse: string;
  caution: string;
  keywords: string[];
};

export const mockPlants: PlantProfile[] = [
  {
    name: 'Jahe',
    latinName: 'Zingiber officinale',
    icon: '🫚',
    category: 'Rimpang',
    description: 'Rimpang aromatik yang sering digunakan sebagai bahan minuman hangat.',
    traditionalUse: 'Secara tradisional jahe digunakan untuk membantu memberi rasa hangat dan meredakan rasa mual ringan.',
    caution: 'Dapat menimbulkan rasa tidak nyaman pada lambung bagi sebagian orang. Konsultasikan dengan tenaga kesehatan jika sedang hamil atau menggunakan obat rutin.',
    keywords: ['jahe', 'ginger', 'mual', 'hangat'],
  },
  {
    name: 'Kunyit',
    latinName: 'Curcuma longa',
    icon: '🌼',
    category: 'Rimpang',
    description: 'Rimpang berwarna kuning-oranye yang umum dipakai sebagai bumbu dan bahan jamu.',
    traditionalUse: 'Dalam penggunaan tradisional, kunyit sering diolah menjadi minuman atau digunakan sebagai bumbu masakan.',
    caution: 'Hindari konsumsi berlebihan. Bicarakan dengan dokter jika memiliki gangguan empedu atau sedang mengonsumsi pengencer darah.',
    keywords: ['kunyit', 'turmeric', 'kurkuma', 'jamu'],
  },
  {
    name: 'Daun sirih',
    latinName: 'Piper betle',
    icon: '🍃',
    category: 'Daun',
    description: 'Tanaman merambat dengan daun berbentuk hati dan aroma khas.',
    traditionalUse: 'Daun sirih dikenal dalam pemakaian tradisional sebagai bahan ramuan luar dan biasanya direbus terlebih dahulu.',
    caution: 'Bukti manfaat untuk berbagai keluhan masih terbatas. Jangan diminum atau digunakan pada luka tanpa saran tenaga kesehatan.',
    keywords: ['sirih', 'piper betle', 'daun', 'daun sirih'],
  },
  {
    name: 'Lidah buaya',
    latinName: 'Aloe vera',
    icon: '🌵',
    category: 'Daun',
    description: 'Tanaman sukulen dengan daun tebal yang menyimpan gel bening.',
    traditionalUse: 'Gel lidah buaya kerap digunakan pada produk perawatan kulit dan rambut.',
    caution: 'Uji sedikit pada kulit terlebih dahulu. Getah kuningnya tidak untuk diminum dan dapat menyebabkan iritasi atau gangguan pencernaan.',
    keywords: ['lidah buaya', 'aloe', 'aloe vera', 'kulit'],
  },
  {
    name: 'Sambiloto',
    latinName: 'Andrographis paniculata',
    icon: '🌿',
    category: 'Herba',
    description: 'Herba berdaun hijau yang dikenal memiliki rasa sangat pahit.',
    traditionalUse: 'Sambiloto digunakan dalam beberapa ramuan tradisional, tetapi bukan pengganti pengobatan medis.',
    caution: 'Dapat berinteraksi dengan obat dan tidak dianjurkan untuk semua orang. Tanyakan kepada tenaga kesehatan sebelum mengonsumsinya.',
    keywords: ['sambiloto', 'andrographis', 'pahit'],
  },
  {
    name: 'Temulawak',
    latinName: 'Curcuma xanthorrhiza',
    icon: '🟠',
    category: 'Rimpang',
    description: 'Rimpang asli Asia Tenggara yang kerap diolah menjadi jamu.',
    traditionalUse: 'Secara tradisional temulawak digunakan sebagai bahan minuman herbal dan bumbu.',
    caution: 'Manfaatnya bergantung pada kondisi dan cara penggunaan. Konsultasikan dengan dokter jika memiliki penyakit hati atau empedu.',
    keywords: ['temulawak', 'curcuma', 'nafsu makan'],
  },
];

export function getMockPlantAnswer(question: string) {
  const normalizedQuestion = question.toLocaleLowerCase('id');
  const plant = mockPlants.find((item) =>
    item.keywords.some((keyword) => normalizedQuestion.includes(keyword)),
  );

  if (!plant) {
    return 'Aku belum menemukan tanaman yang cocok di data demo. Coba tanyakan tentang jahe, kunyit, sirih, lidah buaya, sambiloto, atau temulawak.';
  }

  return `${plant.name} (${plant.latinName})\n\n${plant.description}\n\nPemakaian tradisional: ${plant.traditionalUse}\n\nPerhatian: ${plant.caution}\n\nInformasi ini bersifat edukasi dan bukan pengganti diagnosis atau saran tenaga kesehatan.`;
}

export function getMockPhotoQuestionAnswer(question: string) {
  const normalizedQuestion = question.toLocaleLowerCase('id');
  const namedPlant = mockPlants.some((plant) =>
    plant.keywords.some((keyword) => normalizedQuestion.includes(keyword)),
  );

  if (namedPlant) {
    return `${getMockPlantAnswer(question)}\n\nJawaban ini berdasarkan nama tanaman yang kamu tulis, bukan hasil analisis foto.`;
  }

  return `Foto dan pertanyaanmu sudah diterima: "${question}"\n\nData demo belum dapat menganalisis isi foto. Sebutkan nama tanamannya di pertanyaan, misalnya "Apa manfaat jahe?", agar aku bisa menjawab dari data tanaman demo.`;
}
