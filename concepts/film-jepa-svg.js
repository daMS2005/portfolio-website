// Narrow (phone) twins of the two architecture diagrams: same labels, laid out in one column.
const t = (x, y, s, c = 's', extra = '') => `<text class="${c}" x="${x}" y="${y}"${extra}>${s}</text>`;
const box = (c, x, y, w, h) => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const p = (c, d, extra = '') => `<path class="${c}" d="${d}"${extra}/>`;
const sub = s => `<tspan baseline-shift="sub" font-size="11">${s}</tspan>`;

export const argus = `<svg class="d jn" viewBox="0 0 320 812" role="img" aria-label="JEPA pretraining diagram">
${box('n', 1, 1, 318, 72)}${t(14, 26, 'Asset-day vector', 't')}${t(14, 46, 'x ∈ ℝᶠ · NaN = missing')}${t(14, 64, 'avail = finite ∧ public')}
${p('a', 'M124 73 V97')}
${box('n', 1, 99, 248, 96)}${t(14, 124, 'Feature mask m', 't')}${t(14, 146, '50% of available features')}${t(14, 165, '≥ 1 visible, ≥ 1 hidden')}${t(14, 184, 'rows with &lt; 2 obs. skipped')}
${p('a', 'M124 195 V219')}
${box('n', 1, 221, 248, 138)}${t(14, 247, `Context encoder f${sub('θ')}`, 't')}${box('n', 12, 258, 226, 40)}${t(22, 283, 'masked proj → GELU → LN', 's', ' style="fill:#fff"')}${t(14, 321, '+ residual [Linear · GELU · LN]')}${t(14, 343, 'Linear → embedding · LN')}
${p('a', 'M124 359 V383')}
${box('n', 1, 385, 248, 96)}${t(14, 410, `Predictor g${sub('φ')}`, 't')}${t(14, 432, 'two-layer MLP')}${t(14, 451, 'GELU · Dropout')}${t(14, 470, 'outputs ẑ')}
${p('a', 'M124 481 V505')}
${box('nl', 1, 507, 248, 118)}${t(14, 532, 'L1 latent loss', 't')}${t(14, 554, 'mean |ẑ − sg(z)|')}${t(14, 574, 'valid rows only')}${t(14, 594, 'Adam on θ, φ')}${t(14, 614, 'cosine LR / epoch')}
${p('ag', 'M124 657 V629')}${t(134, 648, 'z, stop-gradient')}
${box('nf', 1, 659, 248, 108)}${t(14, 685, `Target encoder f${sub('θ̄')}`, 't')}${t(14, 707, 'same architecture, EMA weights')}${t(14, 727, 'no gradients · eval mode')}${t(14, 747, 'outputs z')}
${p('ay', 'M249 290 H272 V690 H253')}${t(1, 790, 'EMA after every Adam step', 's', ' style="fill:#e8b26a"')}${t(1, 808, 'θ̄ ← m·θ̄ + (1 − m)·θ', 's', ' style="fill:#e8b26a"')}
${p('ag', 'M298 73 V740 H253')}${t(306, 300, 'full view (no mask)', 's', ' transform="rotate(90 306 300)"')}
</svg>`;

const blocks = [['Block 0', 'dense SwiGLU', 'nm', 's'], ['Block 1', 'dense SwiGLU', 'nm', 's'], ['Block 2', 'MoE', 'nk', 'k'], ['Block 3', 'MoE', 'nk', 'k'], ['Block 4', 'dense SwiGLU', 'nm', 's'], ['Block 5', 'dense SwiGLU', 'nm', 's']]
  .map(([n, d, c, dc], i) => box(c, 1, 166 + i * 52, 296, 42) + t(16, 192 + i * 52, n, 't') + t(181, 192 + i * 52, d, dc)).join('');
// two-column snake of attention nodes: [col, row, title, lines]
const attn = [[0, 0, 'RMSNorm', ['pre-norm (ln1)'], 'nm'], [1, 0, 'Q, K, V proj', ['multi-head', 'full MHA, no GQA'], 'n'], [1, 1, 'QK-RMSNorm', ['per head, Q and K', 'tames logit scale'], 'n'],
  [0, 1, 'RoPE', ['base 10⁴, pairs', 'offset = cache len'], 'n'], [0, 2, 'Causal SDPA', ['FlashAttention', 'on sm80+'], 'n'], [1, 2, 'Output proj', ['back to residual'], 'n'], [1, 3, '⊕ residual', ['x + attn(ln1 x)'], 'nm']]
  .map(([c, r, n, ls, cls]) => { const x = 10 + c * 148, y = 852 + r * 96; return box(cls, x, y, 136, 80) + t(x + 10, y + 26, n, 't') + ls.map((l, i) => t(x + 10, y + 48 + i * 19, l)).join(''); }).join('');
const note = ['Inference: the KV cache appends', 'already-rotated K and V, so cached', 'positions keep their original RoPE angles.', 'Going past max_seq raises an error instead', 'of silently trimming or re-indexing', 'positions.']
  .map((l, i) => t(10, 1240 + i * 17, l)).join('');
const experts = [1, 2, 3, 4].map(n => { const x = 10 + (n - 1) * 72; return box(n === 2 ? 'nk' : 'nm', x, 1720, 68, 56) + t(x + 12, 1745, `E${n}`, 't') + t(x + 12, 1764, 'SwiGLU'); }).join('');

export const cassa = `<svg class="d jn" viewBox="0 0 320 2120" role="img" aria-label="Causal Transformer architecture diagram">
${box('n', 1, 10, 296, 56)}${t(16, 34, 'JEPA windows [B, T, d]', 't')}${t(16, 54, 'frozen inputs, no gradient into JEPA')}
${p('a', 'M149 66 V88')}
${box('n', 1, 90, 296, 56)}${t(16, 114, 'Embedder: Linear', 't')}${t(16, 134, 'no bias · no tokenizer · no pos. table')}
${p('a', 'M149 146 V164')}${blocks}${p('a', 'M149 468 V488')}
${box('n', 1, 490, 296, 42)}${t(16, 516, 'Final RMSNorm', 't')}
${p('a', 'M73 532 V560')}${p('a', 'M224 532 V560')}
${box('n', 1, 562, 145, 78)}${t(9, 586, 'Linear head', 't')}${t(9, 607, 'point forecast ŷ')}${t(9, 627, '→ MSE')}
${box('n', 152, 562, 145, 78)}${t(159, 586, 'Student-t head', 't')}${t(159, 607, 'μ, σ = softplus + ε')}${t(159, 627, 'ν = 2 + softplus → NLL')}
${p('a', 'M73 640 V668')}${p('a', 'M224 640 V668')}
${box('nl', 1, 670, 296, 110)}${t(16, 696, 'Training objective', 't')}${t(16, 718, 'forecast loss vs. forward returns')}${t(16, 737, 'at every labelled t (valid_mask)')}${t(16, 756, '+ 0.01 × MoE balance loss')}${t(16, 775, 'AdamW · cosine LR · grad clip')}
${p('ag', 'M297 187 H308 V830 H303', ' style="marker-end:none"')}${p('ag', 'M297 317 H315 V1380 H303', ' style="marker-end:none"')}${t(300, 800, 'every block', 's', ' text-anchor="end"')}
${box('pane', 1, 810, 300, 526)}${t(10, 838, 'Attention sub-layer · every block', 'h')}
${p('a', 'M146 892 H156')}${p('a', 'M226 932 V946')}${p('a', 'M158 988 H148')}${p('a', 'M78 1028 V1042')}${p('a', 'M146 1084 H156')}${p('a', 'M226 1124 V1138')}
${attn}${note}
${box('pane', 1, 1346, 300, 768)}${t(10, 1374, 'Feed-forward sub-layer ·', 'h')}${t(10, 1393, 'after RMSNorm (ln2)', 'h')}
${box('nm', 10, 1408, 284, 80)}${t(22, 1432, 'Outer blocks', 't')}${t(22, 1454, 'Dense SwiGLU')}${t(22, 1474, 'W↓(SiLU(W_g h) ⊙ W↑ h)')}
${t(10, 1512, 'Middle blocks · mixture of experts', 'k')}
${box('n', 10, 1522, 284, 76)}${t(22, 1546, 'Router', 't')}${t(22, 1567, 'Linear → experts')}${t(22, 1586, 'softmax over all (fp32)')}
${p('a', 'M152 1598 V1612')}
${box('n', 10, 1614, 284, 76)}${t(22, 1638, 'Top-k gates p', 't')}${t(22, 1659, 'not renormalized →')}${t(22, 1678, 'router keeps a gradient')}
${t(294, 1708, 'token → its expert', 's', ' text-anchor="end"')}${p('ao', 'M152 1690 C 152 1706, 116 1702, 116 1718')}
${experts}${p('ao', 'M116 1776 V1802')}
${box('nk', 10, 1804, 284, 100)}${t(22, 1828, `y = Σ p${sub('k')} · E${sub('k')}(h)`, 't')}${t(22, 1849, 'dropless · no capacity limit')}${t(22, 1872, 'Triton: sorted tiles,', 'k')}${t(22, 1890, 'fused up/gate/SiLU/down', 'k')}
${box('nl', 10, 1916, 284, 96)}${t(22, 1940, 'Balance loss', 't')}${t(22, 1962, 'N · Σ load · mean(p) · load is detached')}${t(22, 1981, '(Switch-style, top-k) averaged over the')}${t(22, 2000, 'MoE blocks, × 0.01')}
${box('nm', 10, 2024, 284, 82)}${t(22, 2048, '⊕ residual', 't')}${t(22, 2069, 'x + ffn(ln2 x) → next block.')}${t(22, 2088, 'First and last blocks are always dense.')}
</svg>`;
