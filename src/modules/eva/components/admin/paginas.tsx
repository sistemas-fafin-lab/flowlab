import React from 'react';
import { CalendarClock, ClipboardCheck, Settings, Users } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import EmBreve from './EmBreve';

// Abas da administração da EVA (/it/eva/*). Estados vazios até as issues da Fase 2:
// Sugestões (11), Reuniões (09 e 10), Membros e Configurações (07).

export const EvaSugestoesPage: React.FC = () => (
  <EvaAdminShell subtitulo="O que a EVA propõe e espera aprovação">
    <EmBreve
      icon={ClipboardCheck}
      titulo="Fila de sugestões"
      descricao="Tudo o que a EVA propõe passa por aqui antes de mudar o Kanban."
      itens={[
        'Cards novos, mudanças e comentários vindos das reuniões, do chat, dos comentários e do WhatsApp',
        'O trecho que justifica cada sugestão e a confiança da EVA',
        'Gestores aprovam (e a EVA executa na hora), editam ou rejeitam com motivo',
      ]}
    />
  </EvaAdminShell>
);

export const EvaReunioesPage: React.FC = () => (
  <EvaAdminShell subtitulo="Reuniões que a EVA leu">
    <EmBreve
      icon={CalendarClock}
      titulo="Reuniões"
      descricao="Os resumos do Granola e os colados à mão, com o resultado da análise."
      itens={[
        'Sincronização diária com a pasta "Team meetings" do Granola, e o botão "Buscar reuniões agora"',
        'Colar um resumo à mão quando a reunião não estiver no Granola',
        'Quantas sugestões saíram de cada reunião, e quem respondeu (Claude ou Gemini)',
      ]}
    />
  </EvaAdminShell>
);

export const EvaMembrosPage: React.FC = () => (
  <EvaAdminShell subtitulo="Quem a EVA conhece e acompanha">
    <EmBreve
      icon={Users}
      titulo="Membros"
      descricao="Liga cada pessoa do FlowLab aos nomes com que aparece nas reuniões e ao WhatsApp."
      itens={[
        'Apelidos usados nas reuniões ("@Gabriel Carneiro")',
        'WhatsApp e adesão à cobrança diária',
        'Mensagem de teste e histórico de envios',
      ]}
    />
  </EvaAdminShell>
);

export const EvaConfiguracoesPage: React.FC = () => (
  <EvaAdminShell subtitulo="Como a EVA funciona">
    <EmBreve
      icon={Settings}
      titulo="Configurações"
      descricao="Liga e desliga o WhatsApp e mostra a saúde das integrações."
      itens={[
        'Liga/desliga do WhatsApp e da cobrança diária',
        'Pasta do Granola e dias para considerar um card parado',
        'Situação do Granola, do WhatsApp e da IA (Claude e Gemini), com o gasto da semana',
      ]}
    />
  </EvaAdminShell>
);
