import ValueFlash from './ValueFlash.jsx';

/**
 * props:
 *   stages = { first:{futPnl,optPnl,total}, second:{…} }
 *   totals = { fut, opt, total }
 */
export default function StatsPanel({ stages = {}, totals = {} }) {
  const order = ['first', 'second'];
  return (
    <aside className="stats-panel">
      <h3 className="stats-title">
        Positions&nbsp;
        <span className="pos-dot"
              title={Object.keys(stages).length ? 'Есть активная позиция' : 'Позиции нет'}
              style={{ background:Object.keys(stages).length ? '#00cc66' : '#cc0033' }}/>
      </h3>

      {order.map(k => stages[k] && (
        <div key={k}>
          <div className="stats-row"><span>{k} Futures uPnL:</span>
            <ValueFlash value={stages[k].futPnl} formatter={v=>v==null?'-':Number(v).toFixed(2)} /></div>
          <div className="stats-row"><span>{k} Options uPnL:</span>
            <ValueFlash value={stages[k].optPnl} formatter={v=>v==null?'-':Number(v).toFixed(2)} /></div>
          <div className="stats-row"><span>{k} Total uPnL:</span>
            <ValueFlash value={stages[k].total}  formatter={v=>v==null?'-':Number(v).toFixed(2)} /></div>
        </div>
      ))}

      <div className="stats-row total">
        <span>Total uPnL:</span>
        <ValueFlash value={totals.total} formatter={v=>v==null?'-':Number(v).toFixed(2)} />
      </div>
    </aside>
  );
}
