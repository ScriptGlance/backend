import { OperationComponentDto } from '../../presentations/dto/OperationComponentDto';
import { TextOperationType } from '../enum/TextOperationType';

export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (Array.isArray(obj)) {
    const clonedArray: any[] = [];
    for (let i = 0; i < obj.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      clonedArray[i] = deepClone(obj[i]);
    }
    return clonedArray as T;
  }

  const clonedObj = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
};

export const transform = (
  opsA: OperationComponentDto[],
  opsB: OperationComponentDto[],
): OperationComponentDto[] => {
  const a: OperationComponentDto[] = deepClone(opsA);
  const b: OperationComponentDto[] = deepClone(opsB);

  const resOpsA: OperationComponentDto[] = [];

  let idxA = 0;
  let idxB = 0;

  while (idxA < a.length || idxB < b.length) {
    const opA = idxA < a.length ? a[idxA] : null;
    const opB = idxB < b.length ? b[idxB] : null;

    if (
      opA &&
      opA.type === TextOperationType.Insert &&
      opB &&
      opB.type === TextOperationType.Insert
    ) {
      if ((opA.userId || 0) <= (opB.userId || 0)) {
        resOpsA.push(deepClone(opA));
        idxA++;
      } else {
        resOpsA.push({
          type: TextOperationType.Retain,
          count: opB.text?.length || 0,
        });
        idxB++;
      }
      continue;
    }

    if (opA && opA.type === TextOperationType.Insert) {
      resOpsA.push(deepClone(opA));
      idxA++;
      continue;
    }

    if (opB && opB.type === TextOperationType.Insert) {
      resOpsA.push({
        type: TextOperationType.Retain,
        count: opB.text?.length || 0,
      });

      idxB++;
      continue;
    }

    if (opB && opB.type === TextOperationType.Insert) {
      if (opB.text && opB.text.length > 0) {
        const retainForBInsert: OperationComponentDto = {
          type: TextOperationType.Retain,
          count: opB.text.length,
        };
        resOpsA.push(retainForBInsert);
      }
      idxB++;
      continue;
    }

    if (!opA && !opB) {
      break;
    }

    if (!opA && opB) {
      idxB++;
      continue;
    }
    if (opA && !opB) {
      resOpsA.push(deepClone(opA));
      idxA++;

      continue;
    }

    if (!opA || !opB) {
      break;
    }

    const lenA = opA.count ?? 0;
    const lenB = opB.count ?? 0;
    const minLen = Math.min(lenA, lenB);

    if (
      opA.type === TextOperationType.Retain &&
      opB.type === TextOperationType.Retain
    ) {
      if (minLen > 0)
        resOpsA.push({ type: TextOperationType.Retain, count: minLen });
    } else if (
      opA.type === TextOperationType.Delete &&
      opB.type === TextOperationType.Retain
    ) {
      if (minLen > 0)
        resOpsA.push({ type: TextOperationType.Delete, count: minLen });
    }

    if (opA.count !== undefined) opA.count -= minLen;
    if (opB.count !== undefined) opB.count -= minLen;

    if (opA.count === 0) idxA++;
    if (opB.count === 0) idxB++;
  }

  const optimized: OperationComponentDto[] = [];
  for (let i = 0; i < resOpsA.length; i++) {
    const currentOp = resOpsA[i];
    if (
      (currentOp.type === TextOperationType.Retain ||
        currentOp.type === TextOperationType.Delete) &&
      (!currentOp.count || currentOp.count === 0)
    ) {
      continue;
    }
    if (
      currentOp.type === TextOperationType.Insert &&
      (!currentOp.text || currentOp.text === '')
    ) {
      continue;
    }

    if (optimized.length > 0) {
      const lastOp = optimized[optimized.length - 1];
      if (lastOp.type === currentOp.type) {
        if (currentOp.type === TextOperationType.Insert) {
          if (lastOp.text !== undefined && currentOp.text !== undefined) {
            lastOp.text += currentOp.text;
            continue;
          }
        } else {
          if (lastOp.count !== undefined && currentOp.count !== undefined) {
            lastOp.count += currentOp.count;
            continue;
          }
        }
      }
    }
    optimized.push(currentOp);
  }
  return optimized;
};
