// MiniMax T2A v2 system voices.
// Reference: https://platform.minimaxi.com/document/T2A%20V2
export const MINIMAX_VOICES = [
  // Chinese - Female
  { id: "female-shaonv",     label: "少女音（女）",       lang: "zh", gender: "female" },
  { id: "female-yujie",      label: "御姐音（女）",       lang: "zh", gender: "female" },
  { id: "female-chengshu",   label: "成熟女声（女）",     lang: "zh", gender: "female" },
  { id: "female-tianmei",    label: "甜美女声（女）",     lang: "zh", gender: "female" },
  { id: "presenter_female",  label: "女主持人",          lang: "zh", gender: "female" },
  { id: "audiobook_female_1",label: "有声书女声 1",       lang: "zh", gender: "female" },
  { id: "audiobook_female_2",label: "有声书女声 2",       lang: "zh", gender: "female" },

  // Chinese - Male
  { id: "male-qn-qingse",    label: "青年男声·清涩（男）", lang: "zh", gender: "male" },
  { id: "male-qn-jingying",  label: "青年男声·精英（男）", lang: "zh", gender: "male" },
  { id: "male-qn-badao",     label: "青年男声·霸道（男）", lang: "zh", gender: "male" },
  { id: "male-qn-daxuesheng",label: "大学生男声（男）",   lang: "zh", gender: "male" },
  { id: "presenter_male",    label: "男主持人",          lang: "zh", gender: "male" },
  { id: "audiobook_male_1",  label: "有声书男声 1",       lang: "zh", gender: "male" },
  { id: "audiobook_male_2",  label: "有声书男声 2",       lang: "zh", gender: "male" },

  // Kids
  { id: "clever_boy",        label: "聪明男孩",          lang: "zh", gender: "child" },
  { id: "cute_boy",          label: "可爱男孩",          lang: "zh", gender: "child" },
  { id: "lovely_girl",       label: "萌萌女孩",          lang: "zh", gender: "child" },

  // English
  { id: "Wise_Woman",        label: "Wise Woman (EN)",   lang: "en", gender: "female" },
  { id: "Friendly_Person",   label: "Friendly Person (EN)", lang: "en", gender: "female" },
  { id: "Inspirational_girl",label: "Inspirational Girl (EN)", lang: "en", gender: "female" },
  { id: "Deep_Voice_Man",    label: "Deep Voice Man (EN)", lang: "en", gender: "male" },
  { id: "Calm_Woman",        label: "Calm Woman (EN)",   lang: "en", gender: "female" },
  { id: "Casual_Guy",        label: "Casual Guy (EN)",   lang: "en", gender: "male" },
  { id: "Lively_Girl",       label: "Lively Girl (EN)",  lang: "en", gender: "female" },
  { id: "Patient_Man",       label: "Patient Man (EN)",  lang: "en", gender: "male" },
  { id: "Young_Knight",      label: "Young Knight (EN)", lang: "en", gender: "male" },
  { id: "Determined_Man",    label: "Determined Man (EN)", lang: "en", gender: "male" },
];

export function populateVoiceSelect(selectEl, lang) {
  selectEl.innerHTML = "";
  const groups = { female: "女声", male: "男声", child: "童声" };
  const filtered = MINIMAX_VOICES.filter(v => !lang || v.lang === lang);
  for (const g of Object.keys(groups)) {
    const opts = filtered.filter(v => v.gender === g);
    if (!opts.length) continue;
    const og = document.createElement("optgroup");
    og.label = groups[g];
    for (const v of opts) {
      const o = document.createElement("option");
      o.value = v.id;
      o.textContent = v.label;
      og.appendChild(o);
    }
    selectEl.appendChild(og);
  }
}
