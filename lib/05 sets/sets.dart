void main(){

var numerosLista = [];

numerosLista.add(1);
numerosLista.add(2);
numerosLista.add(4);
numerosLista.add(4);
numerosLista.add(3);
numerosLista.add(null);
numerosLista.add(2);
numerosLista.add(1);


print(numerosLista);

var numerosSet = <int?>{};

numerosSet.add(1);
numerosSet.add(2);
numerosSet.add(4);
numerosSet.add(4);
numerosSet.add(3);
numerosSet.add(null);
numerosSet.add(2);
numerosSet.add(1);


print(numerosSet);



print('.toSet');

print(numerosLista.toSet());

numerosLista.forEach(print);

var numero1 = {1,2,3,4,5,6};
var numero2 = {1,3,4,7};

print('.Difference');
print(numero1.difference(numero2));


print('.Union');
print(numero1.union(numero2));


print('.intersection');
print(numero1.intersection(numero2));

var nomes1 = {'Rodrigo', 'Jose', 'Carlos'};
var nomes2 = {'Miguel', 'Jose', 'Joao'};
print(nomes1.intersection(nomes2));



print('.lookup');
print(numero1.lookup(1));
print(numero1.lookup(99));

}