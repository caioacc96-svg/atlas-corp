import { useEffect, useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useAppStore } from '../../store/appStore';
import { WorkspaceSettings } from '../../shared/types';
import { themePresets, technicalProfiles } from '../../shared/constants';
import { activeLanguageIds, languageProfiles } from '../../shared/languages';

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const openDataFolder = useAppStore((state) => state.openDataFolder);
  const [form, setForm] = useState<WorkspaceSettings>(settings);

  useEffect(() => setForm(settings), [settings]);

  const activeLanguages = useMemo(
    () => activeLanguageIds.filter((languageId) => !form.inactiveLanguages.includes(languageId)),
    [form.inactiveLanguages],
  );

  const save = async () => {
    await updateSettings({
      ...form,
      preferredLanguages: form.preferredLanguages.filter(Boolean),
      inactiveLanguages: form.inactiveLanguages.filter(Boolean),
      languagePriority: form.languagePriority.filter(Boolean),
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <Card title="Configurações básicas" subtitle="Preferências centrais do Atlas, identidade visual e camada poliglota de apoio ao núcleo conversacional." >
        <div className="space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/70">Nome do workspace</span>
            <input className="mt-2 w-full rounded-2xl border border-atlas-line bg-white px-3 py-3 text-sm outline-none" value={form.workspaceName} onChange={(event) => setForm((prev) => ({ ...prev, workspaceName: event.target.value }))} />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/70">Identidade visual padrão</span>
            <select className="mt-2 w-full rounded-2xl border border-atlas-line bg-white px-3 py-3 text-sm outline-none" value={form.themePreset} onChange={(event) => setForm((prev) => ({ ...prev, themePreset: event.target.value as WorkspaceSettings['themePreset'] }))}>
              {themePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/70">Tela inicial</span>
            <select className="mt-2 w-full rounded-2xl border border-atlas-line bg-white px-3 py-3 text-sm outline-none" value={form.launchScreen} onChange={(event) => setForm((prev) => ({ ...prev, launchScreen: event.target.value as WorkspaceSettings['launchScreen'] }))}>
              <option value="chat">atlas chat</option>
              <option value="dashboard">dashboard legado</option>
              <option value="workspace">workspace legado</option>
              <option value="projects">projects</option>
              <option value="memory">memory</option>
              <option value="research">pesquisa viva</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/70">Perfil técnico predominante</span>
            <select className="mt-2 w-full rounded-2xl border border-atlas-line bg-white px-3 py-3 text-sm outline-none" value={form.technicalProfile} onChange={(event) => setForm((prev) => ({ ...prev, technicalProfile: event.target.value as WorkspaceSettings['technicalProfile'] }))}>
              {technicalProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/70">Linguagens preferidas</span>
            <input
              className="mt-2 w-full rounded-2xl border border-atlas-line bg-white px-3 py-3 text-sm outline-none"
              value={form.preferredLanguages.join(', ')}
              onChange={(event) => setForm((prev) => ({ ...prev, preferredLanguages: event.target.value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) as WorkspaceSettings['preferredLanguages'] }))}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/70">Linguagens inativas</span>
            <input
              className="mt-2 w-full rounded-2xl border border-atlas-line bg-white px-3 py-3 text-sm outline-none"
              value={form.inactiveLanguages.join(', ')}
              onChange={(event) => setForm((prev) => ({ ...prev, inactiveLanguages: event.target.value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) as WorkspaceSettings['inactiveLanguages'] }))}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/70">Prioridade de linguagens</span>
            <input
              className="mt-2 w-full rounded-2xl border border-atlas-line bg-white px-3 py-3 text-sm outline-none"
              value={form.languagePriority.join(', ')}
              onChange={(event) => setForm((prev) => ({ ...prev, languagePriority: event.target.value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) as WorkspaceSettings['languagePriority'] }))}
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button onClick={save} className="rounded-2xl border border-atlas-soft bg-atlas-mist px-4 py-3 text-sm font-medium text-atlas-ink">
              Salvar preferências
            </button>
            <button onClick={() => void openDataFolder()} className="inline-flex items-center gap-2 rounded-2xl border border-atlas-line bg-white px-4 py-3 text-sm font-medium text-atlas-body/85">
              <FolderOpen className="h-4 w-4" />
              Abrir pasta de dados
            </button>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card title="Leitura vital do sistema" subtitle="A versão 0.7.0 reorganiza o Atlas em torno do núcleo conversacional real.">
          <div className="space-y-4 text-sm leading-7 text-atlas-body/85">
            <p>O chat agora é a superfície principal do produto. O backend responde pela integração com modelo real, pelo streaming e pela persistência das threads.</p>
            <p>As demais capacidades do Atlas continuam como bordas futuras: tools, memória expandida, pesquisa, conectores e ambientes especializados.</p>
            <p>A camada poliglota continua contida, útil e persistível, preservando o MVP enquanto prepara ferramentas futuras sem inflar a UI agora.</p>
          </div>
        </Card>

        <Card title="Horizonte poliglota ativo" subtitle="Domínio técnico reconhecido com utilidade real, sem virar IDE inflado.">
          <div className="grid gap-3 md:grid-cols-2">
            {activeLanguages.map((languageId) => (
              <div key={languageId} className="rounded-[22px] border border-atlas-line bg-atlas-paper px-4 py-4">
                <p className="font-medium text-atlas-ink">{languageProfiles[languageId].label}</p>
                <p className="mt-2 text-sm leading-6 text-atlas-body/80">{languageProfiles[languageId].summary}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
