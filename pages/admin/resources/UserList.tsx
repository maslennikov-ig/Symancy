
import React from "react";
import { List, useTable, DateField } from "@refinedev/antd";
import { Table } from "antd";

export const UserList: React.FC = () => {
  const { tableProps } = useTable({
    resource: "profiles",
    sorters: { initial: [{ field: "created_at", order: "desc" }] }
  });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="full_name" title="Name" />
        <Table.Column dataIndex="email" title="Email" />
        <Table.Column 
            dataIndex="created_at" 
            title="Joined" 
            render={(val) => <DateField value={val} format="LL" />}
        />
      </Table>
    </List>
  );
};
