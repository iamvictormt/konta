import { useState, type FormEvent } from "react";
import type { CashSession, Expense, Sale } from "../../../lib/model";
import Icon from "../../ui-icon";
import FormField from "../../ui/form-field";
import MaskedNumberInput from "../../ui/masked-number-input";
import { dayLabel, money } from "../format";
import type { Activity } from "../types";
import { ActivityRow } from "../shared/activity-row";
import { PageHeading } from "../shared/page-heading";

export function CashView({ sessions, sales, expenses, cashBalance, onOpenSession, onCloseSession, onAddExpense }: { sessions: CashSession[]; sales: Sale[]; expenses: Expense[]; cashBalance: number; onOpenSession: (openingAmount: number) => void | Promise<void>; onCloseSession: (countedAmount: number) => void | Promise<void>; onAddExpense: () => void }) {
  const [openingAmount, setOpeningAmount] = useState("0");
  const [countedAmount, setCountedAmount] = useState("");
  const activeSession = sessions.find((session) => session.status === "open") ?? null;
  const selectedSession = activeSession ?? sessions[0] ?? null;
  const sessionSales = selectedSession ? sales.filter((sale) => sale.cashSessionId === selectedSession.id) : [];
  const sessionExpenses = selectedSession ? expenses.filter((expense) => expense.cashSessionId === selectedSession.id) : [];
  const totalSales = sessionSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalExpenses = sessionExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const displayedBalance = selectedSession ? selectedSession.openingAmount + totalSales - totalExpenses : 0;
  const countedValue = countedAmount ? Number(countedAmount) : null;
  const difference = countedValue === null ? null : countedValue - cashBalance;
  const movements: Activity[] = [
    ...sessionSales.map((sale) => ({ id: sale.id, createdAt: sale.createdAt, title: "Venda em dinheiro", detail: sale.syncState === "failed" ? "Falha de sincronização" : sale.syncState === "pending" ? "Pendente de sincronização" : "Registada", amount: sale.total, kind: "sale" as const })),
    ...sessionExpenses.map((expense) => ({ id: expense.id, createdAt: expense.createdAt, title: expense.description, detail: expense.syncState === "failed" ? "Falha de sincronização" : expense.syncState === "pending" ? "Pendente de sincronização" : expense.category, amount: expense.amount, kind: "expense" as const })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  function submitOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (openingAmount === "") return;
    void onOpenSession(Number(openingAmount));
  }

  function submitClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSession || countedAmount === "") return;
    void onCloseSession(Number(countedAmount));
  }

  function sessionStatus(session: CashSession) {
    if (session.status === "open") return "Aberta";
    if (session.syncState === "failed") return "Fechada · falha de sincronização";
    if (session.syncState === "pending") return "Fechada · por sincronizar";
    return "Fechada";
  }

  return <>
    <PageHeading title="Caixa" subtitle="Abra, acompanhe e confira o dinheiro de cada sessão."><button className="button button-primary" type="button" onClick={onAddExpense} disabled={!activeSession} title={activeSession ? "Lançar uma despesa nesta sessão" : "Abra uma sessão de caixa primeiro"}><Icon name="plus" size={16} />Lançar despesa</button></PageHeading>

    {!activeSession ? <section className="panel cash-session-panel">
      <div className="cash-session-heading"><span className="cash-session-icon"><Icon name="cash" size={20} /></span><div><h2>Abrir sessão de caixa</h2><p>Registe o fundo que está na caixa antes de iniciar as vendas.</p></div></div>
      <form className="cash-session-form" onSubmit={submitOpen}>
        <FormField id="cash-opening-amount" label="Fundo inicial (Db)"><MaskedNumberInput id="cash-opening-amount" required minValue={0} value={openingAmount} onValueChange={setOpeningAmount} placeholder="0" /></FormField>
        <button className="button button-primary" type="submit"><Icon name="check" size={16} />Abrir caixa</button>
      </form>
      <p className="cash-session-help"><Icon name="wifi-off" size={15} />Após o primeiro acesso online, pode continuar offline. A sessão fica guardada neste dispositivo e sincroniza quando a ligação regressar.</p>
    </section> : <section className="panel cash-session-panel">
      <div className="cash-session-heading"><span className="cash-session-icon is-open"><Icon name="cash" size={20} /></span><div><h2>Sessão em curso</h2><p>Aberta {dayLabel(new Date(activeSession.openedAt), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}{activeSession.openedByName ? ` por ${activeSession.openedByName}` : ""}.</p></div><span className={`cash-session-status ${activeSession.syncState}`}>{activeSession.syncState === "failed" ? "Falha de sincronização" : activeSession.syncState === "pending" ? "Pendente" : "Sincronizada"}</span></div>
      <form className="cash-session-form cash-session-form--close" onSubmit={submitClose}>
        <FormField id="cash-counted-amount" label="Dinheiro contado (Db)"><MaskedNumberInput id="cash-counted-amount" required minValue={0} value={countedAmount} onValueChange={setCountedAmount} placeholder="Introduza o valor contado" /></FormField>
        <button className="button button-primary" type="submit" disabled={countedAmount === ""}><Icon name="check" size={16} />Fechar sessão</button>
      </form>
      <div className={`cash-difference ${difference === null ? "" : difference < 0 ? "is-short" : difference > 0 ? "is-surplus" : "is-balanced"}`}>
        <span>Saldo esperado: <strong>{money(cashBalance)}</strong></span>
        {difference === null ? <span>Introduza a contagem para conferir a diferença.</span> : <span>{difference === 0 ? "Sem diferença" : difference < 0 ? "Falta" : "Sobra"} <strong>{money(Math.abs(difference))}</strong> face ao saldo esperado.</span>}
      </div>
    </section>}

    {selectedSession && <div className="cash-summary cash-summary--session"><div className="panel cash-stat"><span>Fundo inicial</span><strong>{money(selectedSession.openingAmount)}</strong></div><div className="panel cash-stat"><span>Entradas da sessão</span><strong>{money(totalSales)}</strong></div><div className="panel cash-stat"><span>Despesas da sessão</span><strong>{money(totalExpenses)}</strong></div><div className="panel cash-stat"><span>{activeSession ? "Saldo esperado" : "Saldo no fecho"}</span><strong>{money(displayedBalance)}</strong></div></div>}

    <section className="panel cash-session-section">
      <div className="panel-header"><div><h2 className="panel-title"><span className="panel-title-icon"><Icon name="receipt" size={18} /></span>Movimentos {activeSession ? "da sessão actual" : selectedSession ? "da última sessão" : "de caixa"}</h2><p className="panel-subtitle">{selectedSession ? `Sessão iniciada ${dayLabel(new Date(selectedSession.openedAt), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Os lançamentos ficam agrupados por sessão e dispositivo."}</p></div>{selectedSession && <span className={`cash-session-status ${selectedSession.status === "open" ? "open" : selectedSession.syncState}`}>{sessionStatus(selectedSession)}</span>}</div>
      <div className="activity-list">{movements.map((item) => <ActivityRow key={item.id} item={item} />)}{movements.length === 0 && <div className="empty-row cash-empty-state">{selectedSession ? "Ainda não há movimentos nesta sessão." : "Abra uma sessão para começar a registar vendas e despesas."}</div>}</div>
    </section>

    <section className="panel cash-session-section cash-history-section">
      <div className="panel-header"><div><h2 className="panel-title">Sessões recentes</h2><p className="panel-subtitle">Histórico deste dispositivo e reconciliação de fecho.</p></div></div>
      {sessions.length === 0 ? <div className="empty-row cash-empty-state cash-history-empty">Ainda não há sessões de caixa neste dispositivo.</div> : <div className="cash-history-list">{sessions.slice(0, 8).map((session) => {
        const sessionSaleTotal = sales.filter((sale) => sale.cashSessionId === session.id).reduce((sum, sale) => sum + sale.total, 0);
        const sessionExpenseTotal = expenses.filter((expense) => expense.cashSessionId === session.id).reduce((sum, expense) => sum + expense.amount, 0);
        const expected = session.openingAmount + sessionSaleTotal - sessionExpenseTotal;
        const actualDifference = session.countedAmount === undefined ? undefined : session.countedAmount - expected;
        return <article className="cash-history-row" key={session.id}>
          <div className="cash-history-title"><strong>{dayLabel(new Date(session.openedAt), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong><span className={`cash-session-status ${session.status === "open" ? "open" : session.syncState}`}>{sessionStatus(session)}</span></div>
          <p className="cash-history-actors">
            <span>Aberta por <strong>{session.openedByName ?? "Utilizador não identificado"}</strong></span>
            {session.closedAt && <span>Fechada por <strong>{session.closedByName ?? "Utilizador não identificado"}</strong></span>}
          </p>
          <dl className="cash-history-values"><div><dt>Fundo</dt><dd>{money(session.openingAmount)}</dd></div><div><dt>Vendas</dt><dd>{money(sessionSaleTotal)}</dd></div><div><dt>Despesas</dt><dd>{money(sessionExpenseTotal)}</dd></div><div><dt>Esperado</dt><dd>{money(expected)}</dd></div><div><dt>Contado</dt><dd>{session.countedAmount === undefined ? "—" : money(session.countedAmount)}</dd></div><div><dt>Diferença</dt><dd className={actualDifference === undefined ? "" : actualDifference < 0 ? "is-negative" : actualDifference > 0 ? "is-positive" : ""}>{actualDifference === undefined ? "—" : money(actualDifference)}</dd></div></dl>
        </article>;
      })}</div>}
    </section>
  </>;
}
