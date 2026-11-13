import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import {
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';

type ReportCategory =
  | 'trainee_performance'
  | 'scenario_assessment'
  | 'session_summary'
  | 'critical_errors'
  | 'training_progress';

interface ReportsViewProps {
  sessions: TrainingSession[];
  scenarios: ScenarioDefinition[];
  users: UserAccount[];
  institutionName: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  sessions,
  scenarios,
  users,
  institutionName,
}) => {
  const [reportCategory, setReportCategory] =
    useState<ReportCategory>('trainee_performance');
  const [includeDemo, setIncludeDemo] = useState<boolean>(true);
  const [traineeFilter, setTraineeFilter] = useState<string>('all');

  const trainees = useMemo(
    () => users.filter((u) => u.role === 'trainee'),
    [users]
  );

  const completedSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.status === 'completed' &&
          s.assessment &&
          (includeDemo || !s.isDemo) &&
          (traineeFilter === 'all' || s.traineeId === traineeFilter)
      ),
    [sessions, includeDemo, traineeFilter]
  );

  const reportDataset = useMemo(() => {
    if (reportCategory === 'trainee_performance') {
      const columns = [
        'Trainee',
        'Cohort',
        'Record Type',
        'Completed Sessions',
        'Mean Score',
        'Procedural %',
        'Decision %',
        'Avg Response (s)',
        'Total Critical Errors',
      ];
      const rows = trainees
        .filter((t) => traineeFilter === 'all' || t.id === traineeFilter)
        .map((t) => {
          const list = completedSessions.filter((s) => s.traineeId === t.id);
          const n = list.length;
          if (n === 0) {
            return [
              t.name,
              t.cohort,
              t.isDemo ? 'DEMO DATA' : 'USER RECORD',
              '0',
              '0',
              '0%',
              '0%',
              '0s',
              '0',
            ];
          }
          const avgScore = Math.round(
            list.reduce((a, s) => a + (s.assessment?.overallScore || 0), 0) / n
          );
          const avgProc = Math.round(
            list.reduce(
              (a, s) => a + (s.assessment?.proceduralAccuracy || 0),
              0
            ) / n
          );
          const avgDec = Math.round(
            list.reduce((a, s) => a + (s.assessment?.decisionAccuracy || 0), 0) /
              n
          );
          const avgLat = (
            list.reduce(
              (a, s) => a + (s.assessment?.avgResponseTimeSec || 0),
              0
            ) / n
          ).toFixed(1);
          const crit = list.reduce(
            (a, s) => a + (s.assessment?.criticalErrorsCount || 0),
            0
          );

          return [
            t.name,
            t.cohort,
            t.isDemo ? 'DEMO DATA' : 'USER RECORD',
            String(n),
            `${avgScore}/100`,
            `${avgProc}%`,
            `${avgDec}%`,
            `${avgLat}s`,
            String(crit),
          ];
        });
      return {
        title: 'Individual Trainee Performance Report',
        columns,
        rows,
      };
    }

    if (reportCategory === 'scenario_assessment') {
      const columns = [
        'Scenario Code',
        'Scenario Title',
        'Difficulty',
        'Runs',
        'Mean Score',
        'Procedural %',
        'Decision %',
        'Critical Error Count',
      ];
      const rows = scenarios.map((sc) => {
        const list = completedSessions.filter((s) => s.scenarioId === sc.id);
        const n = list.length;
        const avgScore =
          n > 0
            ? Math.round(
                list.reduce((a, s) => a + (s.assessment?.overallScore || 0), 0) /
                  n
              )
            : 0;
        const avgProc =
          n > 0
            ? Math.round(
                list.reduce(
                  (a, s) => a + (s.assessment?.proceduralAccuracy || 0),
                  0
                ) / n
              )
            : 0;
        const avgDec =
          n > 0
            ? Math.round(
                list.reduce(
                  (a, s) => a + (s.assessment?.decisionAccuracy || 0),
                  0
                ) / n
              )
            : 0;
        const crit = list.reduce(
          (a, s) => a + (s.assessment?.criticalErrorsCount || 0),
          0
        );
        return [
          sc.code,
          sc.title,
          sc.difficulty,
          String(n),
          `${avgScore}/100`,
          `${avgProc}%`,
          `${avgDec}%`,
          String(crit),
        ];
      });
      return {
        title: 'Scenario Assessment Summary Report',
        columns,
        rows,
      };
    }

    if (reportCategory === 'session_summary') {
      const columns = [
        'Session ID',
        'Trainee',
        'Scenario',
        'Attempt',
        'Duration',
        'Score',
        'Critical Errors',
        'Simulated Outcome',
      ];
      const rows = completedSessions.map((s) => [
        s.id,
        s.traineeName,
        s.scenarioCode,
        `#${s.attemptNumber}`,
        `${s.durationSec}s`,
        `${s.assessment?.overallScore ?? 0}/100`,
        String(s.assessment?.criticalErrorsCount ?? 0),
        s.assessment?.simulatedOutcome || '',
      ]);
      return {
        title: 'Detailed Session Summaries Report',
        columns,
        rows,
      };
    }

    if (reportCategory === 'critical_errors') {
      const columns = [
        'Session ID',
        'Trainee',
        'Scenario',
        'Record Type',
        'Critical Violation Description',
      ];
      const rows: string[][] = [];
      completedSessions.forEach((s) => {
        (s.assessment?.criticalErrors || []).forEach((err) => {
          rows.push([
            s.id,
            s.traineeName,
            s.scenarioCode,
            s.isDemo ? 'DEMO DATA' : 'USER SESSION',
            err,
          ]);
        });
      });
      return {
        title: 'Critical Safety & Protocol Error Audit Report',
        columns,
        rows,
      };
    }

    // training_progress
    const columns = [
      'Date',
      'Trainee',
      'Scenario',
      'Attempt #',
      'Procedural %',
      'Sequence %',
      'Avg Latency',
      'Overall Score',
    ];
    const sorted = [...completedSessions].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    const rows = sorted.map((s) => [
      new Date(s.startedAt).toISOString().slice(0, 10),
      s.traineeName,
      s.scenarioCode,
      `#${s.attemptNumber}`,
      `${s.assessment?.proceduralAccuracy ?? 0}%`,
      `${s.assessment?.sequenceAccuracy ?? 0}%`,
      `${s.assessment?.avgResponseTimeSec ?? 0}s`,
      `${s.assessment?.overallScore ?? 0}/100`,
    ]);
    return {
      title: 'Longitudinal Training Progress Report',
      columns,
      rows,
    };
  }, [reportCategory, trainees, traineeFilter, completedSessions, scenarios]);

  const handleDownloadCsv = () => {
    const escapeCsv = (val: string) =>
      `"${String(val).replace(/"/g, '""')}"`;
    const lines = [
      reportDataset.columns.map(escapeCsv).join(','),
      ...reportDataset.rows.map((r) => r.map(escapeCsv).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iri_${reportCategory}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(15);
    doc.text(
      `IMMERSIVE RESPONSE INTELLIGENCE — ${reportDataset.title}`,
      40,
      42
    );
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(
      `${institutionName} | Generated ${new Date().toLocaleString()} | Educational Prototype Metrics Only`,
      40,
      58
    );

    let y = 84;
    const colWidth = Math.floor(760 / Math.max(1, reportDataset.columns.length));

    doc.setFontSize(8.5);
    doc.setTextColor(20);
    reportDataset.columns.forEach((col, i) => {
      doc.text(col.slice(0, 24), 40 + i * colWidth, y);
    });
    y += 8;
    doc.line(40, y, 800, y);
    y += 14;

    doc.setFontSize(8);
    doc.setTextColor(45);
    reportDataset.rows.forEach((row) => {
      if (y > 540) {
        doc.addPage();
        y = 48;
      }
      row.forEach((cell, i) => {
        const text = String(cell).slice(0, 32);
        doc.text(text, 40 + i * colWidth, y);
      });
      y += 16;
    });

    doc.save(
      `iri_${reportCategory}_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1380px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800/90">
        <div>
          <div className="text-xs font-medium text-cyan-400">
            Structured Export &amp; Audit Documentation
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Reports &amp; Exports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate trainee performance, scenario assessment, session summary, critical error, and longitudinal progress reports with CSV and PDF export.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 text-slate-100 border border-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Report Selector & Filter Controls */}
      <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'trainee_performance', label: 'Trainee Performance' },
              { id: 'scenario_assessment', label: 'Scenario Assessments' },
              { id: 'session_summary', label: 'Session Summaries' },
              { id: 'critical_errors', label: 'Critical Error Audit' },
              { id: 'training_progress', label: 'Training Progress' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportCategory(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                reportCategory === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-[#070B14] text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={traineeFilter}
            onChange={(e) => setTraineeFilter(e.target.value)}
            aria-label="Filter Report by Trainee"
            className="px-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-200"
          >
            <option value="all">All Trainees</option>
            {trainees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>Include DEMO DATA</span>
          </label>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="rounded-xl bg-[#0D1424] border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            {reportDataset.title}
          </div>
          <span className="text-xs font-mono text-slate-400">
            {reportDataset.rows.length} Row(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#070B14] text-[11px] font-medium text-slate-400">
                {reportDataset.columns.map((c) => (
                  <th key={c} className="py-3 px-4 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {reportDataset.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="py-3 px-4 text-slate-200 font-mono tabular-nums"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {reportDataset.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={reportDataset.columns.length}
                    className="py-10 px-4 text-center text-slate-400 text-xs"
                  >
                    No matching records for this report configuration.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
