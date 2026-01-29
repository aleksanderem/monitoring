"use client";

import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Tabs, TabList, Tab, TabPanel } from "@/components/application/tabs/tabs";

export interface SlideoutTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface SlideoutDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  tabs: SlideoutTab[];
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  defaultTab?: string;
}

export function SlideoutDetailView({
  isOpen,
  onClose,
  title,
  tabs,
  actions,
  footer,
  defaultTab,
}: SlideoutDetailViewProps) {
  return (
    <SlideoutMenu isOpen={isOpen} onOpenChange={onClose}>
      <SlideoutMenu.Header onClose={onClose}>
        <div className="flex items-center justify-between pr-10">
          <h2 className="text-xl font-semibold">{title}</h2>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </SlideoutMenu.Header>

      <SlideoutMenu.Content>
        <Tabs defaultSelectedKey={defaultTab || tabs[0]?.id}>
          <TabList
            items={tabs.map(tab => ({
              id: tab.id,
              label: tab.label,
              children: tab.label
            }))}
            type="underline"
            size="md"
            className="border-b border-gray-200 pb-0"
          />

          {tabs.map((tab) => (
            <TabPanel key={tab.id} id={tab.id} className="pt-6">
              {tab.content}
            </TabPanel>
          ))}
        </Tabs>
      </SlideoutMenu.Content>

      {footer && (
        <SlideoutMenu.Footer>
          <div className="flex justify-end gap-3">{footer}</div>
        </SlideoutMenu.Footer>
      )}
    </SlideoutMenu>
  );
}
