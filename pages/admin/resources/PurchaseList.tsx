
import React from "react";
import { List, useTable, DateField, NumberField } from "@refinedev/antd";
import { Table, Tag } from "antd";

export const PurchaseList: React.FC = () => {
  const { tableProps } = useTable({
    resource: "purchases",
    sorters: { initial: [{ field: "created_at", order: "desc" }] }
  });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="product_type" title="Product" />
        <Table.Column 
            dataIndex="amount_rub" 
            title="Amount (RUB)" 
            render={(val) => <NumberField value={val} options={{ style: 'currency', currency: 'RUB' }} />}
        />
        <Table.Column 
            dataIndex="status" 
            title="Status"
            render={(val) => (
                <Tag color={val === 'succeeded' ? 'green' : val === 'pending' ? 'orange' : 'red'}>
                    {val}
                </Tag>
            )}
        />
        <Table.Column 
            dataIndex="created_at" 
            title="Date"
            render={(val) => <DateField value={val} format="LLL" />}
        />
      </Table>
    </List>
  );
};
