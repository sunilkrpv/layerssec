'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import LayersLogo from '@/components/LayersLogo';
import { isLoggedIn } from '@/lib/authStore';
import {
  apiGetProjectsSummary, apiListActivity,
  type ProjectSummary, type AiJobListItem,
} from '@/lib/api';
import HomeSidebar from './HomeSidebar';
import AllProjectsDashboard from './AllProjectsDashboard';
import ProjectCommandCenter from './ProjectCommandCenter';
import NewProjectChat from './NewProjectChat';
import AiSettingsPage from './AiSettingsPage';
import OnboardingProvider from './onboarding/OnboardingProvider';
import WelcomeModal from './onboarding/WelcomeModal';
import AiSetupTour from './onboarding/AiSetupTour';
import AiNotConfiguredBanner from './onboarding/AiNotConfiguredBanner';
import OnboardingChecklist from './onboarding/OnboardingChecklist';

type ActiveView = 'all-projects' | 'my-projects' | 'threats' | 'posture' | 'project' | 'new-project' | 'settings';

export default function AppShell() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  // View state
  const [activeView, setActiveView] = useState<ActiveView>('all-projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Data
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeJobs, setActiveJobs] = useState<AiJobListItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<AiJobListItem[]>([]);
  const [attackSimTotal, setAttackSimTotal] = useState(0);

  // Auth check
  useEffect(() => {
    const loggedIn = isLoggedIn();
    setAuthed(loggedIn);
    if (!loggedIn) router.replace('/login');
  }, [router]);

  // Projects — poll every 60s
  const loadProjects = useCallback(async () => {
    try {
      const data = await apiGetProjectsSummary();
      setProjects(data);
    } catch { /* ignore */ }
    finally { setLoadingProjects(false); }
  }, []);

  useEffect(() => {
    void loadProjects();
    const id = setInterval(loadProjects, 60_000);
    return () => clearInterval(id);
  }, [loadProjects]);

  // Active jobs — poll every 8s
  useEffect(() => {
    const poll = async () => {
      try {
        const result = await apiListActivity({ statuses: ['RUNNING', 'PENDING'], limit: 20 });
        setActiveJobs(result.jobs);
      } catch { /* ignore */ }
    };
    void poll();
    const id = setInterval(poll, 8_000);
    return () => clearInterval(id);
  }, []);

  // Recent activity + attack sim total — load once on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [recent, sims] = await Promise.all([
          apiListActivity({ limit: 10 }),
          apiListActivity({ types: ['ATTACK_SIMULATION'], statuses: ['COMPLETED'] }),
        ]);
        setRecentActivity(recent.jobs);
        setAttackSimTotal(sims.total);
      } catch { /* ignore */ }
    };
    void load();
  }, []);

  // Computed aggregates
  const totalThreats = useMemo(
    () => projects.reduce((s, p) => s + p.openThreatCount, 0),
    [projects],
  );
  const criticalThreats = useMemo(
    () => projects.reduce((s, p) => s + p.criticalThreatCount, 0),
    [projects],
  );
  const avgPosture = useMemo(() => {
    const scored = projects.filter((p) => p.latestPostureScore !== null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, p) => s + p.latestPostureScore!, 0) / scored.length);
  }, [projects]);

  // Handlers
  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectId(id);
    setActiveView('project');
  }, []);

  const handleNewProject = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('new-project');
  }, []);

  const handleProjectCreated = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    void loadProjects();
  }, [loadProjects]);

  const handleOpenSettings = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('settings');
  }, []);

  const handleShowDashboard = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('all-projects');
  }, []);

  const handleShowMyProjects = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('my-projects');
  }, []);

  const handleShowThreats = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('threats');
  }, []);

  const handleShowPosture = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('posture');
  }, []);

  if (authed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LayersLogo size={24} className="animate-pulse text-blue-500" />
      </div>
    );
  }

  if (!authed) return null;

  return (
    <OnboardingProvider>
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <AiNotConfiguredBanner onOpenSettings={handleOpenSettings} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <HomeSidebar
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        onOpenSettings={handleOpenSettings}
        onShowDashboard={handleShowDashboard}
        onShowMyProjects={handleShowMyProjects}
        onShowThreats={handleShowThreats}
        onShowPosture={handleShowPosture}
        projects={projects}
        loadingProjects={loadingProjects}
        activeJobCount={activeJobs.length}
        totalThreats={totalThreats}
        criticalThreats={criticalThreats}
        avgPosture={avgPosture}
        attackSimTotal={attackSimTotal}
        activeView={activeView}
      />

      <main className="flex-1 overflow-hidden">
        {activeView === 'new-project' ? (
          <NewProjectChat
            onDismiss={handleShowDashboard}
            onCreated={handleProjectCreated}
          />
        ) : activeView === 'settings' ? (
          <AiSettingsPage />
        ) : activeView === 'project' && selectedProjectId ? (
          <ProjectCommandCenter key={selectedProjectId} projectId={selectedProjectId} />
        ) : (
          <AllProjectsDashboard
            projects={projects}
            activeJobs={activeJobs}
            recentActivity={recentActivity}
            attackSimTotal={attackSimTotal}
            totalThreats={totalThreats}
            criticalThreats={criticalThreats}
            avgPosture={avgPosture}
            loading={loadingProjects}
            onSelectProject={handleSelectProject}
            onNewProject={handleNewProject}
            onRefresh={loadProjects}
            section={
              activeView === 'threats' ? 'threats'
              : activeView === 'posture' ? 'posture'
              : activeView === 'my-projects' ? 'projects'
              : 'all'
            }
          />
        )}
      </main>
      </div>
      <WelcomeModal />
      <AiSetupTour onOpenSettings={handleOpenSettings} />
      <OnboardingChecklist onOpenSettings={handleOpenSettings} onNewProject={handleNewProject} />
    </div>
    </OnboardingProvider>
  );
}
