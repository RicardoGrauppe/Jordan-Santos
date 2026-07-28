/*
  Template do contrato — FONTE ÚNICA.

  Antes o texto vivia solto dentro de assinar.html, e revisar-contrato.html tinha
  só o cabeçalho + tabela, com um aviso no lugar das dez cláusulas ("omitido aqui
  só pra revisão ficar mais rápida de rolar"). Ou seja: o Jordan confirmava e
  assinava um documento cujas cláusulas a tela nunca mostrou, e o banco gravava
  jordan_confirmado_em como se ele tivesse revisado o inteiro teor. Agora as duas
  páginas renderizam ESTE arquivo — o que ele revisa é, literalmente, o que o
  casal assina.

  Base: "Contrato de Casamento (modelo Jordan).docx" (Assets/ do cliente), com
  três correções que o docx pede e uma cláusula a mais:
    - o docx numera DUAS cláusulas como "OITAVA" (uso de imagem e foro de
      eleição); aqui o foro é a NONA;
    - o docx traz a linha solta "30010111777900" no meio do foro — removida;
    - erros de digitação do docx corrigidos (pulicada → publicada, desta
      intensão → desta intenção, mediante ao pagamento → mediante o pagamento);
    - CLÁUSULA DÉCIMA (assinatura eletrônica) não existe no docx: é ela que
      sustenta juridicamente o fluxo de /assinar (MP 2.200-2/2001, art. 10 §2º).
      NÃO remover ao sincronizar com uma via nova do Jordan.

  Uso:
    <article id="documento"></article>
    <script src="/contrato-template.js"></script>
    <script>
      document.getElementById("documento").innerHTML =
        CONTRATO_TEMPLATE.html({ modo: "assinar" });   // ou "revisar"
    </script>

  O `modo` muda SÓ a legenda embaixo da linha de assinatura do casal (orientação
  de tela, não texto contratual). O corpo do contrato é idêntico nos dois.

  Os valores são preenchidos depois, pelas páginas, via [data-campo="..."]:
    noivo, cpf-noivo, noiva, cpf-noiva, endereco, numero, bairro, cidade,
    complemento, estado, cep, tel-noivo, tel-noiva, data-formatada, local,
    horario, valor-total, valor-entrada, cidade-assinatura, data-assinatura
  Mais o <tbody id="tabela-servicos"> e o <div id="assinatura-jordan-area">.
  Mexeu num data-campo aqui? Confira assinar.html e revisar-contrato.html.
*/
(function (global) {
  "use strict";

  function html(opts) {
    var o = opts || {};
    var legendaCasal = o.modo === "revisar"
      ? "Assinatura do(a) contratante (o casal assina depois, em /assinar)"
      : "Assinatura do(a) contratante";

    return `
      <h2>Contrato de Prestação de Serviços de Fotografia</h2>

      <p>Que entre si fazem, de um lado, Jordan Santos com CPF 071.176.769-65 com endereço na rua Jesuítas, Carimã Nº390, Foz do Iguaçu &ndash; Paraná, CEP: 85855700 e Telefone: (45) 99907-7874 &mdash; www.jordansantosfotografia.com.br &mdash; correspondente a prestador de serviços relacionados à fotografia, que aqui denominada CONTRATADA, e do outro lado como CONTRATANTES:</p>

      <p>
        NOIVO: <span class="campo" data-campo="noivo"></span> &nbsp; CPF: <span class="campo" data-campo="cpf-noivo"></span><br>
        NOIVA: <span class="campo" data-campo="noiva"></span> &nbsp; CPF: <span class="campo" data-campo="cpf-noiva"></span><br>
        ENDEREÇO: <span class="campo" data-campo="endereco"></span> &nbsp; Nº: <span class="campo" data-campo="numero"></span> &nbsp; BAIRRO: <span class="campo" data-campo="bairro"></span><br>
        CIDADE: <span class="campo" data-campo="cidade"></span> &nbsp; COMPLEMENTO: <span class="campo" data-campo="complemento"></span> &nbsp; ESTADO: <span class="campo" data-campo="estado"></span> &nbsp; CEP: <span class="campo" data-campo="cep"></span><br>
        TELEFONE NOIVO: <span class="campo" data-campo="tel-noivo"></span> &nbsp; TELEFONE NOIVA: <span class="campo" data-campo="tel-noiva"></span>
      </p>

      <p>Tem entre si como certo e ajustado o presente contrato de prestação de serviços que será regido pelas seguintes cláusulas:</p>

      <h3>CLÁUSULA PRIMEIRA &ndash; OBJETO:</h3>
      <p>Constitui o objeto do presente contrato a prestação de serviços fotográficos e/ou de vídeos, conforme descrito abaixo:</p>
      <p>
        DESCRIÇÃO DO EVENTO: Casamento<br>
        DATA DO EVENTO: <span class="campo" data-campo="data-formatada"></span><br>
        LOCAL DO EVENTO: <span class="campo" data-campo="local"></span><br>
        HORÁRIO: <span class="campo" data-campo="horario"></span>
      </p>
      <table aria-label="Serviços contratados">
        <thead>
          <tr><th>Qtd</th><th>Descrição dos serviços</th><th>Valor total</th></tr>
        </thead>
        <tbody id="tabela-servicos"></tbody>
      </table>

      <h3>CLÁUSULA SEGUNDA &ndash; VALOR CONTRATUAL E CONDIÇÕES DE PAGAMENTO:</h3>
      <ol>
        <li>Pelo objeto ora contratado, a CONTRATANTE pagará à CONTRATADA o valor total de <span class="campo" data-campo="valor-total"></span> com entrada de 30% (<span class="campo" data-campo="valor-entrada"></span>) na assinatura do contrato mediante recibo ou depósito bancário, entendida como reserva de data. Chave Pix cel 45999077874 nome Jordan Sant.</li>
        <li>Pagamentos antecipados não sofrem alterações de valores e nem acréscimos de juros em caso de parcelas, exceto por cartão de crédito via o sistema &ldquo;Pagseguro&rdquo; (ou outro meio que utilizar).</li>
        <li>Os pagamentos devem ocorrer nas datas combinadas, sendo cabível multa de 2% calculados sobre o valor total deste contrato, mais multa moratória de 0,5% por dia de atraso após o evento.</li>
        <li>O não cumprimento das obrigações financeiras do CONTRATANTE acarretará na nulidade do cumprimento dos prazos por parte CONTRATADO, a não entrega dos materiais até a regularização das obrigações, e em alguns casos específicos, a não realização do serviço contratado.</li>
        <li>Para eventos em cidades com 100km de Foz do Iguaçu ou fora do estado do Paraná, fica estabelecido que os CONTRATANTES suportarão as despesas de transportes, terrestres ou aéreos, com o mínimo de uma diária de hospedagem para o CONTRATADO e sua equipe.</li>
        <li>Eventuais acréscimos ao orçamento por conta de horas-extras, estacionamento, alimentação, taxas cobradas por Igrejas ou salões de eventos, deverão ser reembolsadas à CONTRATADA, em uma só parcela.</li>
      </ol>

      <h3>CLÁUSULA TERCEIRA &ndash; SOBRE O CANCELAMENTO DO EVENTO OU RESCISÃO DO CONTRATO:</h3>
      <p>Diante da possibilidade de o evento ter sua data alterada, ser definitivamente cancelado ou as partes desejarem rescindir o presente contrato, as partes estabelecem o seguinte:</p>
      <ol>
        <li>No caso de falecimento de qualquer dos CONTRATANTES, ANTES DO INICIO DAS ATIVIDADES PARA O EVENTO, o presente contrato será rescindido de pleno direito, e ao CONTRATANTE supérstite será devolvido 100% do que já tenha sido pago, sem quaisquer acréscimos, APÓS O INÍCIO DAS ATIVIDADES será devolvido 80%. No caso de falecimento do CONTRATADO, os CONTRATANTES poderão optar pela continuação do contrato com a equipe do CONTRATADO ou pela rescisão do contrato com recebimento na mesma regra citada neste item. O falecimento de qualquer das partes após o evento não interferirá no cumprimento integral deste contrato.</li>
        <li>Caso os CONTRATANTES decidam mudar a data do evento, havendo disponibilidade na agenda da CONTRATADA o contrato seguirá com a tabela de preços da nova data escolhida junto com uma multa de 10% sobre o valor do contrato atual, exceto por catástrofes naturais ou justificativas de força maior. Não havendo disponibilidade de agenda pela CONTRATADA, os CONTRATANTES deverão pedir a rescisão e o cálculo da multa obedecerá aos critérios percentuais fixados no item a seguir.</li>
        <li>Em caso de rescisão, por ambas as partes, o DESISTENTE deverá comunicar com antecedência apresentando uma justificativa através do e-mail da outra parte, pagando multa contratual, além dos demais valores, fixada nos seguintes critérios:</li>
      </ol>
      <p>Multa Contratual sobre o valor total do contrato:</p>
      <ol>
        <li>Comunicação com antecedência de até 300 dias em relação ao evento &ndash; multa de 10%.</li>
        <li>Comunicação com antecedência de 299 até 240 dias em relação ao evento &ndash; multa de 20%.</li>
        <li>Comunicação com antecedência de 239 até 180 dias em relação ao evento &ndash; multa de 30%.</li>
        <li>Comunicação com antecedência de 179 até 120 dias em relação ao evento &ndash; multa de 40%.</li>
        <li>Comunicação com antecedência de 119 até 60 dias em relação ao evento &ndash; multa de 50%.</li>
        <li>Comunicação com antecedência de 59 até 31 dias em relação ao evento &ndash; multa de 70%.</li>
        <li>Comunicação com antecedência inferior a 30 dias em relação ao evento &ndash; multa de 80%.</li>
      </ol>
      <p>Reserva de data:</p>
      <p>O valor de reserva de data não é passível de resgate e não tem relação com o valor da multa rescisória &ndash; Visto que trabalhamos com apenas um evento por dia.</p>
      <p>Os gastos e prejuízos do CONTRATADO:</p>
      <ol>
        <li>Em caso de rescisão pelo CONTRATANTE, este se responsabilizará por todos os gastos e prejuízos que o CONTRATADO já teve em virtude do presente contrato, além das demais obrigações deste parágrafo.</li>
        <li>Em caso do não comparecimento ao evento por parte da CONTRATADA, sujeitará aos CONTRATANTES o pagamento de multa em 100% (cem por cento) do valor deste contrato, mais 100% (cem por cento) do mesmo valor aos pelos danos morais e materiais.</li>
        <li>Nas hipóteses de caso fortuito ou de força maior que o impeça de estar presente ao evento objeto deste contrato, a CONTRATADA poderá cumprir as obrigações assumidas neste contrato através da nomeação de outros profissionais que possuam as mesmas capacitações técnicas e as mesmas características estéticas, sem que isso represente infração contratual.</li>
      </ol>

      <h3>CLÁUSULA QUARTA &ndash; MATERIAL DE ESCOLHA E PRAZOS:</h3>
      <ol>
        <li>Todas as fotos serão editadas após passar por uma seleção, e enviadas para o site de escolha em até (20 dias úteis), podendo ser prorrogados por mais (15 dias úteis) em períodos sazonais com aviso prévio. ATENÇÃO: Contratantes do PACOTES DIGITAL estão isentos do item 2 ao 7 desta cláusula.</li>
        <li>O CONTRATANTE terá um prazo de (30 dias) para selecionar as fotos, podendo ser prorrogado gratuitamente por mais (15 dias). Se ainda sim precisar de mais tempo, deverá escolher uma das seguintes opções: para mais 15 dias no site de escolha (R$ 50,00); para mais 30 dias no site de escolha (R$ 100,00); para mais 60 dias no site de escolha (R$ 150,00).</li>
        <li>Após finalizada a seleção o CONTRATANTE deverá clicar no botão ENVIAR SELEÇÃO. A devolução da lista escolhida é feita automaticamente através do próprio sistema.</li>
        <li>Após a seleção das fotos, uma amostra do álbum será apresentada ao CONTRATANTE em até (30 dias úteis) podendo ser prorrogado por mais (15 dias úteis) em períodos sazonais com aviso prévio. O mesmo terá um prazo de até (7 dias) para solicitar pequenos ajustes ou aprovar para a impressão.</li>
        <li>A primeira alteração nas páginas do álbum é gratuita e irreversível. Após feitas as alterações, na segunda solicitação será cobrada uma taxa de R$ 50,00 pelos custos de diagramação não previstos no orçamento.</li>
        <li>Após aprovado, o álbum é enviado para produção e entregue ao CONTRATANTE em até (45 dias úteis).</li>
        <li>Não finalizada a seleção em (60 dias adicionais) após o período gratuito de (45 dias) anula o cumprimento de todos os prazos e passa a aguardar a vez até que outros trabalhos em dia passem a ser concluídos.</li>
        <li>Após (6 meses) sem finalizar a seleção das fotos, o CONTRATANTE atribui à CONTRATADA a autorização para escolher e editar as fotos do álbum, além de possíveis reajustes nos produtos ainda não enviados para produção.</li>
        <li>Caso não informado na CLÁUSULA 1 desse documento o fornecimento de todas as imagens, o material de escolha terá a marca d'água com os direitos autorais e o texto (PROIBIDO PUBLICAR). Significa que o pacote escolhido não inclui todas as imagens originais, e com base no art. 7º, inc. VII da Lei nº 9.610/98 o CONTRATANTE não possui autorização para imprimir/revelar o material em outro estabelecimento ou publicar imagens sem o consentimento da CONTRATADA. Sendo o único arquivo original a ser entregue sem as proteções de direitos autorais a quantidade de imagens escolhidas, conforme o pacote adquirido, sendo essas de livre utilização e sem fins comerciais.</li>
        <li>Todas as fotos ficam arquivadas em suportes digitais pertencentes à CONTRATADA por um período de (18 meses) após a data do evento, ficando à disposição do CONTRATANTE mediante nova remuneração. Após esse período os arquivos serão apagados.</li>
      </ol>

      <h3>CLÁUSULA QUINTA &ndash; AS OBRIGAÇÕES DOS CONTRATANTES:</h3>
      <ol>
        <li>Os CONTRATANTES obrigam-se a apresentar à CONTRATADA, com antecedência, um roteiro completo com a sequência de fatos e horários do que acontecerá durante o evento, principalmente se qualquer atração especial e/ou não comum estiver prevista.</li>
        <li>Deverão, os CONTRATANTES, no mesmo prazo, informar eventual desejo de ter fotografado algum momento específico (oração, discurso, homenagem, etc.). Esta exigência permitirá que a CONTRATADA se prepare e se posicione adequadamente de forma a não deixar de registrar tudo o que for relevante, respeitados os limites técnicos para troca de bateria ou cartões das câmeras. O não recebimento deste roteiro isentará a CONTRATADA da responsabilidade pela falta de registro de acontecimentos não usuais.</li>
        <li>Os CONTRATANTES deverão comunicar inequivocamente, com antecedência, os locais e horários da preparação dos noivos, local e horário da cerimônia, local e horário da festa, endereço e horário de check in e check out do hotel, além dos contatos da assessoria e os demais envolvidos em relação ao evento. Caso as informações precisem ser alteradas, os CONTRATADOS também deverão ser comunicados com antecedência.</li>
        <li>A não comunicação nos termos aqui estabelecidos isentará a CONTRATADA de quaisquer responsabilidades pela não realização de cada etapa do trabalho.</li>
        <li>Para todos os efeitos, as partes pactuam como sendo obrigatório apenas o registro da preparação da noiva. A preparação do noivo e os detalhes da decoração da igreja e do salão antes do evento iniciar somente serão registrados caso os horários e as condições de trânsito permitam, quando serão incluídos no trabalho sem qualquer despesa extra para os CONTRATANTES.</li>
        <li>Os CONTRATANTES se comprometem a não comparar a CONTRATADA com outras empresas em relação a prazos, formas de pagamento ou intervir nos fornecedores com a intenção de minimizar custos, cabendo à CONTRATADA decidir tais ações.</li>
        <li>Os CONTRATANTES têm o livre direito de comunicar suas preferências e contribuir com ideias e dicas para que o trabalho fique satisfatório.</li>
        <li>Os CONTRATANTES se comprometem a não exigir cópias idênticas de trabalhos já existentes no mercado, respeitando eticamente a propriedade autoral de cada profissional. Além de não solicitar ideias que inferiorize o estilo de trabalho da CONTRATADA.</li>
      </ol>

      <h3>CLÁUSULA SEXTA &ndash; AS OBRIGAÇÕES DA CONTRATADA:</h3>
      <ol>
        <li>Considerando a natureza do serviço e que seu produto é legalmente definido como obra intelectual, a CONTRATADA dispõe de ampla liberdade de criação, não havendo qualquer parâmetro norteador por parte dos CONTRATANTES.</li>
        <li>A CONTRATADA diligenciará para que os serviços alcancem o nível técnico ideal, comprometendo-se a executar de forma regular e eficiente todas as atividades descritas na Cláusula Primeira (objeto). No entanto, cabe aos CONTRATANTES gerenciar ou contratar uma empresa responsável pela organização, espaço e ordem. Eventos tumultuados ou em locais desagradáveis não são garantias para obter boas imagens.</li>
        <li>A CONTRATADA se compromete em estar à disposição dos CONTRATANTES durante todo o dia do evento, ficando até o término de todas as atividades do protocolo de acordo com o roteiro a ser enviado.</li>
        <li>A CONTRATADA autoriza a permanência dos profissionais para fotografias e vídeos sociais (revistas, jornais, blogs e bandas, DJs, decoradores...) no dia do evento, desde que os mesmos se comprometam a não interferir ou obstruir o trabalho da CONTRATADA, e nem comercializar as imagens adquiridas, sendo de inteira responsabilidade dos mesmos o conteúdo produzido e publicado, podendo responder por seus atos.</li>
        <li>Ao autorizar a permanência dos profissionais sociais, os CONTRATANTES assumem estar cientes de que poderão ocorrer possíveis obstruções nas cenas a serem gravadas ou fotografadas e de que a CONTRATADA não tem como removê-los na pós-produção/edição.</li>
        <li>Os álbuns descritos nos pacotes são de qualidade profissional, produzidos por empresas brasileiras e portuguesas certificadas e conceituadas no mercado fotográfico. Em caso de possível alteração por parte dos fornecedores, a CONTRATADA se compromete em fornecer opções de substituição com mesmo nível de qualidade.</li>
      </ol>

      <h3>CLÁUSULA SÉTIMA &ndash; INFORMAÇÕES E CONDIÇÕES GERAIS:</h3>
      <p>Os CONTRATANTES declaram-se cientes de que a correta prestação dos serviços depende de alguns fatores que fogem do controle da CONTRATADA. Desta forma, os CONTRATANTES obrigam-se a:</p>
      <ol>
        <li>Atuar pessoalmente, ou através de cerimonialistas, ajudando a identificar os principais convidados e familiares, de forma que a eles seja dada atenção especial durante o processo de fotografia e captação.</li>
        <li>Orientar a assessoria do evento a consultar a CONTRATADA e equipe antes de autorizar qualquer ato da cerimônia ou da festa declarados no roteiro.</li>
        <li>Disponibilizar refeição sem qualquer custo para a equipe CONTRATADA. Não sendo disponibilizada a alimentação, a equipe CONTRATADA poderá se ausentar do evento por (2 horas) para se alimentarem nos arredores, sendo depois reembolsados pelos CONTRATANTES.</li>
        <li>Tratar com os locais da cerimônia e da festa, para que a CONTRATADA possa trabalhar livremente e sem que sejam cobradas quaisquer taxas, e que, se cobradas, serão depois reembolsadas pelos CONTRATANTES.</li>
        <li>Disponibilizar vagas de estacionamento para os CONTRATADOS próximos aos portões de entrada da igreja e da recepção para maior agilidade na preparação dos equipamentos evitando os atrasos.</li>
        <li>Orientar a equipe de som e iluminação para que utilizem com moderação efeitos de fumaça, evitar a utilização de strobos, e principalmente RAIOS LASER, pois estes recursos podem danificar os sensores das câmeras fotográficas, comprometendo seriamente a qualidade para captação das imagens.</li>
        <li>Comunicar a empresa responsável pela montagem dos televisores, telões ou projetores a deixarem prontos os equipamentos no qual serão exibidos os possíveis vídeos e/ou slide show para os devidos testes com no mínimo de (4 horas) de antecedência. Não sendo possível testar por falta de montagem no horário combinado, ou a falta de qualidade nesses equipamentos coloca em risco o nome da CONTRATADA, a qual fica o poder de decidir exibir ou não os vídeos.</li>
        <li>Alertar pessoalmente, ou através da assessoria do evento, os convidados e eventuais representantes da imprensa, que a CONTRATADA tem a máxima prioridade na captação, principalmente no que diz respeito a posicionamento e não obstrução da visibilidade.</li>
      </ol>

      <h3>CLÁUSULA OITAVA &ndash; SOBRE A LICENÇA PARA USO DE IMAGEM:</h3>
      <ol>
        <li>Os CONTRATANTES autorizam a CONTRATADA, na forma de cessão de direitos de imagem, a utilizar as fotos e os vídeos captados no decorrer do ensaio e do evento, a título gratuito, destinados à divulgação da CONTRATADA em qualquer material impresso ou audiovisual, tais como revistas, jornais, panfletos, televisão, sites e nas redes sociais. Expostos ao público em geral e/ou para uso interno como portfolio e que poderá ser inscrito em concursos nacionais e internacionais de fotografia.</li>
        <li>A divulgação dos vídeos e das fotos é opcional da CONTRATADA e não será publicada caso o mesmo fuja dos padrões necessários na organização, estética e ordem do evento ou interesses do mesmo.</li>
        <li>Os CONTRATANTES autorizam expressamente o uso da própria imagem e assumem a responsabilidade de comunicar aos seus convidados acerca deste possível uso pela CONTRATADA, respondendo aos CONTRATANTES pela reparação de danos que a CONTRATADA sofra caso algum convidado questione o tal uso.</li>
        <li>A CONTRATADA autoriza as empresas fornecedoras e organizadoras do evento, com o consentimento dos CONTRATANTES, que se comprometem a avisar as mesmas, a utilizarem e compartilharem as imagens para fins publicitários apenas na internet, sempre atribuindo os devidos créditos da CONTRATADA no período de 12 meses após o evento.</li>
        <li>A fotografia é considerada como obra intelectual, e como tal está protegida pelo art. 7º, inc. VII da Lei nº 9.610/98. De acordo com a lei, as empresas fornecedoras e organizadoras do evento que desejarem utilizar as imagens da CONTRATADA em mídias impressas ou audiovisuais deverão solicitar uma autorização por escrito, contendo a finalidade e o prazo de veiculação, mediante o pagamento de 10% do valor deste contrato por mês de utilização aos CONTRATANTES e à CONTRATADA.</li>
        <li>Caso os CONTRATANTES desejem ver suspensa a divulgação deste material, no todo ou em partes, bastará que comuniquem por escrito e de forma inequívoca a CONTRATADA desta intenção, assinalando ao mesmo o prazo de 5 dias úteis que, se obedecido, afastará a caracterização de danos patrimoniais ou morais. Os CONTRATANTES obrigam-se a orientar seus convidados em relação a este procedimento, que também é aplicável a eles.</li>
      </ol>
      <p>Parágrafo Único: A autorização para a CONTRATADA é concedida a título gratuito, abrangendo o uso das imagens acima mencionadas, em todo território nacional e/ou exterior, sem limitação de tempo ou número de utilizações e de maneira alguma as imagens utilizadas poderão agredir a imagem pessoal e a personalidade dos CONTRATANTES e convidados.</p>

      <h3>CLÁUSULA NONA &ndash; FORO DE ELEIÇÃO:</h3>
      <ol>
        <li>Na assinatura deste documento, os CONTRATANTES declaram estar cientes sobre o estilo de trabalho da CONTRATADA.</li>
        <li>As partes elegem como competente para dirimir quaisquer questões relacionadas à interpretação ou aplicação deste contrato o foro da sede dos CONTRATANTES, em detrimento de qualquer outro por mais privilegiado que possa ser.</li>
      </ol>

      <h3>CLÁUSULA DÉCIMA &ndash; DA ASSINATURA ELETRÔNICA:</h3>
      <ol>
        <li>As partes reconhecem a validade, a autenticidade e a eficácia da assinatura eletrônica aposta neste instrumento, aceitando-a expressamente como meio válido de manifestação de vontade e de comprovação de autoria e integridade, nos termos do art. 10, §2º da Medida Provisória nº 2.200-2/2001.</li>
        <li>O signatário é identificado por nome e CPF e acessa este instrumento por meio de link eletrônico exclusivo e não public&aacute;vel, gerado com identificador aleatório e enviado pela CONTRATADA diretamente ao CONTRATANTE, cuja posse constitui o elemento de vinculação do ato à sua pessoa. Ficam registrados, para fins de auditoria, a data e hora, o endereço IP e o dispositivo utilizados, além da impressão digital (hash) do documento assinado.</li>
      </ol>

      <p>E por estarem certos e ajustados, as partes declaram que o presente contrato foi objeto de ampla negociação em todas as suas cláusulas, notadamente aquelas que definem o objeto, o preço e as multas, assinando o mesmo em duas vias de igual forma e teor, na presença de testemunha:</p>

      <div class="assinaturas" id="bloco-assinaturas">
        <p><span class="campo" data-campo="cidade-assinatura"></span>, <span class="campo" data-campo="data-assinatura"></span>.</p>
        <p class="linha-ass">${legendaCasal}</p>
        <div id="assinatura-jordan-area">
          <p class="linha-ass">Jordan Santos &ndash; CONTRATADA</p>
        </div>
      </div>
    `;
  }

  global.CONTRATO_TEMPLATE = { html: html };
})(typeof window !== "undefined" ? window : this);
