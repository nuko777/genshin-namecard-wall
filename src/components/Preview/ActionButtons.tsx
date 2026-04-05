import { Button, Space } from 'antd';

interface ActionButtonsProps {
  onClear: () => void;
  onExport: () => void;
  exportLoading: boolean;
}

export default function ActionButtons({
  onClear,
  onExport,
  exportLoading,
}: ActionButtonsProps) {
  return (
    <div className="action-buttons">
      <Space>
        <Button danger onClick={onClear}>清空</Button>
        <Button type="primary" loading={exportLoading} onClick={onExport}>
          下载预览图 PNG
        </Button>
      </Space>
    </div>
  );
}
