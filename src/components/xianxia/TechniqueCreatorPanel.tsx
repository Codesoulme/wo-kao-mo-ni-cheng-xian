'use client';

import { useState } from 'react';
import {
  createCustomTechnique,
  validateTechniqueInput,
  TECHNIQUE_CATEGORY_LABELS,
  TECHNIQUE_ELEMENT_LABELS,
  type CustomTechnique,
  type TechniqueCategory,
  type TechniqueElement,
} from '@/lib/xianxia/custom-technique';

const REALM_OPTIONS = ['凡人', '练气一层', '练气九层', '筑基', '结丹', '金丹', '元婴', '化神', '炼虚'];

interface Props {
  initialTechniques?: CustomTechnique[];
  onCreate?: (technique: CustomTechnique) => void;
  defaultCollapsed?: boolean;
}

export function TechniqueCreatorPanel({ initialTechniques = [], onCreate, defaultCollapsed = true }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [techniques, setTechniques] = useState<CustomTechnique[]>(initialTechniques);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TechniqueCategory>('sword');
  const [element, setElement] = useState<TechniqueElement>('water');
  const [realm, setRealm] = useState('练气一层');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const handleSubmit = () => {
    const v = validateTechniqueInput({ name, category, element, realmRequirement: realm });
    if (!v.ok) {
      setErrors(v.errors);
      setSubmitted(null);
      return;
    }
    const tech = createCustomTechnique({ name, category, element, realmRequirement: realm });
    setTechniques([tech, ...techniques]);
    if (onCreate) onCreate(tech);
    setName('');
    setErrors([]);
    setSubmitted(`已立「${tech.name}」一法`);
  };

  return (
    <section
      data-testid="technique-creator-panel"
      style={{
        border: '1px solid #d4b478',
        borderRadius: '8px',
        background: 'rgba(255,253,247,0.94)',
        margin: '12px 0',
        padding: '12px 14px',
      }}
    >
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ marginRight: '8px', fontSize: '13px', color: '#5a3a18' }}>
          {collapsed ? '▸' : '▾'}
        </span>
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#3a2818' }}>
          自创功法
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#8a6633' }}>
          {techniques.length} 法
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '2px' }}>功法名</div>
              <input
                data-testid="technique-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：碧波剑诀"
                style={{
                  width: '100%', padding: '4px 6px', fontSize: '12px',
                  border: '1px solid #d4b478', borderRadius: '4px',
                  background: '#fefcf5',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '2px' }}>类型</div>
              <select
                data-testid="technique-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TechniqueCategory)}
                style={{ width: '100%', padding: '4px 6px', fontSize: '12px', border: '1px solid #d4b478', borderRadius: '4px', background: '#fefcf5' }}
              >
                {Object.entries(TECHNIQUE_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '2px' }}>五行</div>
              <select
                data-testid="technique-element-select"
                value={element}
                onChange={(e) => setElement(e.target.value as TechniqueElement)}
                style={{ width: '100%', padding: '4px 6px', fontSize: '12px', border: '1px solid #d4b478', borderRadius: '4px', background: '#fefcf5' }}
              >
                {Object.entries(TECHNIQUE_ELEMENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '2px' }}>境界要求</div>
              <select
                data-testid="technique-realm-select"
                value={realm}
                onChange={(e) => setRealm(e.target.value)}
                style={{ width: '100%', padding: '4px 6px', fontSize: '12px', border: '1px solid #d4b478', borderRadius: '4px', background: '#fefcf5' }}
              >
                {REALM_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            data-testid="technique-submit"
            onClick={handleSubmit}
            style={{
              padding: '4px 12px', fontSize: '12px', fontWeight: 500,
              border: '1px solid #9bbf6c', borderRadius: '4px',
              background: '#f1f7e8', color: '#3a4a1a', cursor: 'pointer',
            }}
          >
            立此一法
          </button>

          {errors.length > 0 && (
            <div data-testid="technique-errors" style={{ marginTop: '8px', fontSize: '11px', color: '#a04040' }}>
              {errors.map((e, i) => <div key={i}>· {e}</div>)}
            </div>
          )}

          {submitted && (
            <div data-testid="technique-submitted" style={{ marginTop: '8px', fontSize: '11px', color: '#3a6a1a' }}>
              {submitted}
            </div>
          )}

          {techniques.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '4px' }}>
                已立之法 · {techniques.length} 部
              </div>
              {techniques.map((t) => (
                <div
                  key={t.id}
                  data-testid={`technique-item-${t.id}`}
                  style={{
                    border: '1px solid #c4a76d', borderRadius: '4px',
                    padding: '6px 8px', marginBottom: '4px', background: '#fefcf5',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 500, fontSize: '13px', color: '#2a1c10' }}>
                      {t.name}
                    </span>
                    <span style={{
                      marginLeft: 'auto', fontSize: '10px', color: '#8a6633',
                      border: '1px solid #c4a76d', borderRadius: '3px', padding: '0px 5px',
                    }}>
                      {TECHNIQUE_CATEGORY_LABELS[t.category]} · {TECHNIQUE_ELEMENT_LABELS[t.element]} · {t.realmRequirement}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#5a3a18' }}>{t.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
