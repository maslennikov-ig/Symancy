
import React from "react";
import { List, useTable, EditButton, DateField } from "@refinedev/antd";
import { Table, Space } from "antd";

interface AppConfig {
  id: number;
  config_key: string;
  config_value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export const ConfigList: React.FC = () => {
  const { tableProps } = useTable({
    resource: "app_config",
    sorters: { initial: [{ field: "config_key", order: "asc" }] }
  });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="config_key" title="Key" />
        <Table.Column 
            dataIndex="config_value" 
            title="Value" 
            render={(value) => <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>}
        />
        <Table.Column dataIndex="description" title="Description" />
        <Table.Column
          title="Actions"
          dataIndex="actions"
          render={(_, record: AppConfig) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
