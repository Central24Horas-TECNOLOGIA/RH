# Projeto Conecta - Padrões Profissionais de Interface (UI)

## Regras de Design (Anti-Estética de IA)

- **Visual SaaS Moderno**: Evite gradientes genéricos, sombras pesadas e o visual padrão "Bootstrap".
- **Sistema de Grade de 8px**: Use uma convenção de espaçamento onde todas as dimensões (margens, preenchimentos, lacunas) são múltiplos de 8 pixels (8px, 16px, 24px, etc.) para garantir consistência visual.
- **Espaço em Branco (White Space)**: Aumente o "respiro" entre os elementos (microspace e macrospace) para melhorar o foco na ação do usuário e reduzir a distração.
- **Hierarquia Tipográfica**: Use pesos e tamanhos de fonte distintos para separar claramente títulos, subtítulos e corpo de texto, facilitando a leitura.
- **Componentes**: Utilize bordas sutis (1px), sombras suaves e cantos arredondados consistentes (entre 6px e 8px).
- **Cores**: Mantenha uma paleta sóbria e limitada, focada na legibilidade dos dados.

## Restrições Técnicas e Segurança

- **Alteração Lógica Zero**: É terminantemente proibido alterar rotas de backend, lógica de banco de dados ou funcionalidades existentes.
- **Foco em UI**: As alterações devem se limitar estritamente a classes CSS/Tailwind ou estruturas visuais de componentes.
- **Eficiência de Tokens**: Retorne apenas as alterações necessárias (estilo diff) ou substitua blocos específicos de código. Não gere arquivos inteiros desnecessariamente.
