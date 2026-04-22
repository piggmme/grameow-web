import {useEffect, useState} from 'react';
import UserDetail from './UserDetail';

export default function UserDetailWrapper() {
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idStr = params.get('id');
    if (idStr) {
      setId(parseInt(idStr, 10));
    }
  }, []);

  if (id === null) return <div style={{padding: 32}}>ID가 필요합니다.</div>;
  return <UserDetail id={id} />;
}
